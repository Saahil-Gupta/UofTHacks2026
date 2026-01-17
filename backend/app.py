from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from backend.graph import build_graph
from backend.models import GraphState, Market
from backend.polymarket import get_mock_markets
from backend.routes.debug_shopify import router as debug_shopify_router

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

app = FastAPI(title="Prophet Agents", version="0.1.0")


# ---- NEW: serve generated images
GENERATED_DIR = Path(__file__).with_name("generated")
GENERATED_DIR.mkdir(exist_ok=True)
app.mount("/generated", StaticFiles(directory=str(GENERATED_DIR)), name="generated")
# -------------------------------
app.include_router(debug_shopify_router)
graph = build_graph()

@app.get("/")
def root():
    return {"ok": True, "docs": "/docs"}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/run_one/{market_id}")
def run_one(market_id: str):
    markets = {m["market_id"]: m for m in get_mock_markets()}
    m = markets.get(market_id)
    if not m:
        return {"ok": False, "error": "unknown market_id", "known": list(markets.keys())}

    state = GraphState(market=Market(**m))
    out = graph.invoke(state)
    return {"ok": True, "state": out}

@app.get("/mock_markets")
def mock_markets():
    return get_mock_markets()
