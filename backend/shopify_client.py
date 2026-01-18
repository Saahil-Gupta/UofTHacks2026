from __future__ import annotations

import os
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


def _shopify_endpoint() -> str:
    domain = os.getenv("SHOPIFY_STORE_DOMAIN", "").strip()
    version = os.getenv("SHOPIFY_API_VERSION", "2026-01").strip()
    if not domain:
        raise RuntimeError("Missing SHOPIFY_STORE_DOMAIN")
    return f"https://{domain}/admin/api/{version}/graphql.json"


def _shopify_headers() -> Dict[str, str]:
    token = os.getenv("SHOPIFY_ACCESS_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Missing SHOPIFY_ACCESS_TOKEN")
    return {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
    }


def _graphql(query: str, variables: Dict[str, Any] | None = None) -> Dict[str, Any]:
    resp = requests.post(
        _shopify_endpoint(),
        headers=_shopify_headers(),
        json={"query": query, "variables": variables or {}},
        timeout=30,
    )

    try:
        payload = resp.json()
    except Exception as e:
        raise RuntimeError(f"Shopify non-JSON response: {resp.status_code} {resp.text[:200]}") from e

    if resp.status_code >= 400:
        raise RuntimeError(f"Shopify HTTP {resp.status_code}: {payload}")

    if payload.get("errors"):
        raise RuntimeError(f"Shopify GraphQL errors: {payload['errors']}")

    return payload.get("data") or {}


PRODUCT_CREATE = """
mutation productCreate($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product {
      id
      title
      variants(first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
"""

VARIANTS_BULK_UPDATE = """
mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    product { id }
    productVariants { id }
    userErrors { field message }
  }
}
"""

PUBLISH_TO_CURRENT_CHANNEL = """
mutation publishablePublishToCurrentChannel($id: ID!) {
  publishablePublishToCurrentChannel(id: $id) {
    userErrors { field message }
  }
}
"""

STAGED_UPLOADS_CREATE = """
mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters { name value }
    }
    userErrors { field message }
  }
}
"""

PRODUCT_UPDATE_ADD_MEDIA = """
mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
  productUpdate(product: $product, media: $media) {
    product {
      id
      media(first: 1) {
        nodes {
          alt
          mediaContentType
          ... on MediaImage {
            image { url }
          }
        }
      }
    }
    userErrors { field message }
  }
}
"""

PRODUCTS_LIST = """
query Products($first: Int!) {
  products(first: $first) {
    edges {
      node {
        id
        title
        handle
        featuredImage {
          url
          altText
        }
      }
    }
  }
}
"""

def list_products(limit: int = 20) -> dict:
    data = _graphql(PRODUCTS_LIST, {"first": limit})
    edges = (data.get("products") or {}).get("edges") or []
    items = []
    for e in edges:
        n = e.get("node") or {}
        img = n.get("featuredImage") or {}
        items.append({
            "id": n.get("id"),
            "title": n.get("title"),
            "handle": n.get("handle"),
            "imageUrl": img.get("url"),
            "imageAlt": img.get("altText"),
        })
    return {"products": items}

def _project_root() -> Path:
    # backend/shopify_client.py -> backend -> project root
    return Path(__file__).resolve().parents[1]


def _resolve_local_image_path(image_data_url: str) -> Optional[Path]:
    # Expecting "/generated/abc.png"
    image_data_url = (image_data_url or "").strip()
    if not image_data_url:
        return None

    if image_data_url.startswith("/generated/"):
        p = _project_root() / image_data_url.lstrip("/")
        return p

    # If someone later passes a direct filesystem path
    p2 = Path(image_data_url)
    if p2.is_absolute() or p2.exists():
        return p2

    return None


def _staged_upload_product_image(local_path: Path) -> str:
    if not local_path.exists():
        raise FileNotFoundError(f"Image not found: {local_path}")

    mime_type = mimetypes.guess_type(local_path.name)[0] or "image/png"

    variables = {
        "input": [
            {
                "filename": local_path.name,
                "mimeType": mime_type,
                "httpMethod": "POST",
                "resource": "PRODUCT_IMAGE",
            }
        ]
    }
    data = _graphql(STAGED_UPLOADS_CREATE, variables)
    out = data.get("stagedUploadsCreate") or {}
    errs = out.get("userErrors") or []
    if errs:
        raise RuntimeError(f"stagedUploadsCreate userErrors: {errs}")

    targets = out.get("stagedTargets") or []
    if not targets:
        raise RuntimeError("stagedUploadsCreate returned no stagedTargets")

    target = targets[0]
    upload_url = target["url"]
    resource_url = target["resourceUrl"]
    params = {kv["name"]: kv["value"] for kv in (target.get("parameters") or [])}

    with local_path.open("rb") as f:
        files = {"file": (local_path.name, f, mime_type)}
        r = requests.post(upload_url, data=params, files=files, timeout=90)
        r.raise_for_status()

    return resource_url


def _attach_image_to_product(product_id: str, local_path: Path, alt: str) -> Dict[str, Any]:
    resource_url = _staged_upload_product_image(local_path)

    variables = {
        "product": {"id": product_id},
        "media": [
            {
                "originalSource": resource_url,
                "mediaContentType": "IMAGE",
                "alt": alt or "",
            }
        ],
    }
    data = _graphql(PRODUCT_UPDATE_ADD_MEDIA, variables)
    pu = data.get("productUpdate") or {}
    errs = pu.get("userErrors") or []
    if errs:
        raise RuntimeError(f"productUpdate userErrors: {errs}")

    return pu


def create_products(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Expected product dict keys from your pipeline:
      title: str
      description: str
      tags: List[str]
      price: float (or str)
      image_data_url: str | None   (local like "/generated/abc.png")
    """
    mode = os.getenv("SHOPIFY_MODE", "real")
    created: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    for p in products:
        title = (p.get("title") or "").strip()
        if not title:
            errors.append({"stage": "input", "title": None, "error": "Missing title"})
            continue

        try:
            # 1) Create product (no variants here)
            product_input = {
                "title": title,
                "descriptionHtml": f"<p>{p.get('description','')}</p>",
                "tags": p.get("tags") or [],
                "status": "ACTIVE",
            }
            data = _graphql(PRODUCT_CREATE, {"product": product_input})
            pc = data.get("productCreate") or {}
            user_errors = pc.get("userErrors") or []
            if user_errors:
                errors.append({"stage": "productCreate", "title": title, "error": user_errors})
                continue

            product = pc.get("product") or {}
            product_id = product.get("id")
            edges = ((product.get("variants") or {}).get("edges")) or []
            variant_id = (edges[0].get("node") or {}).get("id") if edges else None

            if not product_id or not variant_id:
                errors.append({"stage": "productCreate", "title": title, "error": "Missing product_id or default variant_id"})
                continue

            # 2) Set price via productVariantsBulkUpdate
            price_val = p.get("price")
            price_str = f"{float(price_val):.2f}"
            data2 = _graphql(
                VARIANTS_BULK_UPDATE,
                {"productId": product_id, "variants": [{"id": variant_id, "price": price_str}]},
            )
            vbu = data2.get("productVariantsBulkUpdate") or {}
            v_errors = vbu.get("userErrors") or []
            if v_errors:
                errors.append({"stage": "variantPrice", "title": title, "error": v_errors})
                continue

            # 2.5) Attach media (best effort, do not fail the whole product if media fails)
            media_result = None
            media_error = None
            try:
                image_data_url = p.get("image_data_url") or ""
                local_path = _resolve_local_image_path(image_data_url)
                if local_path:
                    media_result = _attach_image_to_product(product_id, local_path, alt=title)
                    image_url = None
                    image_alt = None
                    try:
                        nodes = (((media_result.get("product") or {}).get("media") or {}).get("nodes")) or []
                        if nodes:
                            image_alt = nodes[0].get("alt")
                            img = nodes[0].get("image") or {}
                            image_url = img.get("url")
                    except Exception:
                        pass
            except Exception as e:
                media_error = str(e)

            # 3) Publish (keep it, even if it errors)
            publish_errors = None
            try:
                data3 = _graphql(PUBLISH_TO_CURRENT_CHANNEL, {"id": product_id})
                pub = data3.get("publishablePublishToCurrentChannel") or {}
                publish_errors = pub.get("userErrors") or []
            except Exception as e:
                publish_errors = [{"message": str(e)}]

            created.append(
                {
                    "title": title,
                    "productId": product_id,
                    "variantId": variant_id,
                    "price": price_str,
                    "mediaAttached": bool(media_result),
                    "mediaError": media_error,
                    "publishErrors": publish_errors,
                    "imageUrl": image_url,
                    "imageAlt": image_alt,
                }
            )

        except Exception as e:
            errors.append({"stage": "exception", "title": title, "error": str(e)})

    return {"mode": mode, "created": created, "errors": errors}
