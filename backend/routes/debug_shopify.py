from __future__ import annotations

import os
import requests
from fastapi import APIRouter

router = APIRouter()


@router.get("/debug/shopify/env")
def shopify_env():
    domain = os.getenv("SHOPIFY_STORE_DOMAIN")
    token = os.getenv("SHOPIFY_ACCESS_TOKEN")
    version = os.getenv("SHOPIFY_API_VERSION", "2026-01")
    storefront_domain = os.getenv("SHOPIFY_STOREFRONT_DOMAIN")  # optional

    return {
        "cwd": os.getcwd(),
        "SHOPIFY_STORE_DOMAIN": domain,
        "SHOPIFY_STOREFRONT_DOMAIN": storefront_domain,
        "SHOPIFY_ACCESS_TOKEN_present": bool(token),
        "SHOPIFY_API_VERSION": version,
    }


@router.get("/debug/shopify/ping")
def shopify_ping():
    domain = os.getenv("SHOPIFY_STORE_DOMAIN")
    token = os.getenv("SHOPIFY_ACCESS_TOKEN")
    version = os.getenv("SHOPIFY_API_VERSION", "2026-01")

    if not domain or not token:
        return {"ok": False, "error": "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN"}

    url = f"https://{domain}/admin/api/{version}/graphql.json"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
    }

    query = "query { shop { name myshopifyDomain } }"

    try:
        r = requests.post(url, headers=headers, json={"query": query}, timeout=20)
        ct = (r.headers.get("content-type") or "").lower()

        body = r.json() if "application/json" in ct else r.text

        # GraphQL can return 200 with errors
        ok = (r.status_code < 300) and not (isinstance(body, dict) and body.get("errors"))

        return {"ok": ok, "status": r.status_code, "body": body}
    except Exception as e:
        return {"ok": False, "error": str(e)}
