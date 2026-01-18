from fastapi import APIRouter
from backend.shopify_client import list_products

router = APIRouter()

@router.get("/shopify/products")
def shopify_products(limit: int = 20):
    return list_products(limit=limit)