import requests
import json
import os
from dotenv import load_dotenv

from typing import List
from backend.models import FinalProduct

load_dotenv()  # Load environment variables from .env

SHOP = "my-store-300000000000000003892.myshopify.com"
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")  # or set env var
url = f"https://{SHOP}/admin/api/2026-01/graphql.json"

print(ACCESS_TOKEN)

headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ACCESS_TOKEN,
}

query = """mutation CreateProductWithNewMedia($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
  productCreate(product: $product, media: $media) {
    product { id title media(first: 10) { nodes { alt mediaContentType preview { status } } } }
    userErrors { field message }
  }
}"""

def create_products(final_products: List[FinalProduct]):
    for product in final_products:
        variables = {
            "product": {"title": product.title},
            "media": [
                {
                    "originalSource": product.image_data_url,
                    "alt": product.title,
                    "mediaContentType": "IMAGE",
                },
            ],
        }

        payload = {"query": query, "variables": variables}

        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        print(json.dumps(resp.json(), indent=2))