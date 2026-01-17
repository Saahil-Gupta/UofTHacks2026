from __future__ import annotations

import os
import requests
from typing import Any, Dict, List

def create_products(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    If Shopify env vars are missing, returns a mock result so your demo still runs.
    """
    domain = os.getenv("SHOPIFY_STORE_DOMAIN")
    token = os.getenv("SHOPIFY_ADMIN_TOKEN")
    version = os.getenv("SHOPIFY_API_VERSION", "2024-10")

    if not domain or not token:
        return {
            "mode": "mock",
            "created": [{"title": p["title"], "price": p["price"]} for p in products],
            "errors": [],
        }

    # Minimal REST product create for demo
    url = f"https://{domain}/admin/api/{version}/products.json"
    headers = {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
    }

    created = []
    errors = []

    for p in products:
        payload = {
            "product": {
                "title": p["title"],
                "body_html": p["description"],
                "tags": ", ".join(p.get("tags", [])),
                "variants": [{"price": str(p["price"])}],
            }
        }
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=20)
            if r.status_code >= 300:
                errors.append({"title": p["title"], "status": r.status_code, "body": r.text})
            else:
                created.append(r.json().get("product"))
        except Exception as e:
            errors.append({"title": p["title"], "error": str(e)})

    return {"mode": "real", "created": created, "errors": errors}
