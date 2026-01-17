from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.analytics import AnalyticsStore, ProphetBrain
from app.services.agents import AgentOrchestrator


app = FastAPI(title="Prophet Backend", version="0.1.0")

# Allow your Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons for the hackathon demo
store = AnalyticsStore()
brain = ProphetBrain(user_id="merchant_demo", store=store, model_version="v1.0")
orchestrator = AgentOrchestrator()

# Keep latest recommendation results so the frontend can show them
_latest_by_market: Dict[str, Dict[str, Any]] = {}


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

class MarketSignalIn(BaseModel):
    market_id: str = Field(default="unknown_market")
    source: str = Field(default="Polymarket")
    title: Optional[str] = None
    signal: Optional[str] = None
    category: str = Field(default="Unknown")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    volume_usd: Optional[float] = None


class FeedbackIn(BaseModel):
    market_id: str
    category: str
    action: str  # publish or reject
    reason: Optional[str] = None


class EventsOut(BaseModel):
    events: List[Dict[str, Any]]


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "time": datetime.utcnow().isoformat() + "Z",
    }


@app.post("/signal")
def process_signal(payload: MarketSignalIn) -> Dict[str, Any]:
    """
    Trigger the multi-agent pipeline on a single market signal.
    Logs:
    - market_signal_detected
    - strategy_generated
    Returns the full recommendation object.
    """
    market_data = payload.model_dump()

    result = orchestrator.process_market_signal(
        market_data=market_data,
        brain=brain,
    )

    market_id = str(result.get("market_id", payload.market_id))
    _latest_by_market[market_id] = result
    return result


@app.post("/feedback")
def merchant_feedback(payload: FeedbackIn) -> Dict[str, Any]:
    """
    Close the loop.
    Logs:
    - merchant_feedback
    This is what powers the learning bias on the next run.
    """
    action = payload.action.strip().lower()
    if action not in {"publish", "reject"}:
        raise HTTPException(status_code=400, detail='action must be "publish" or "reject"')

    brain.process_merchant_feedback(
        market_id=payload.market_id,
        category=payload.category,
        action=action,
        reason=payload.reason,
    )

    # Useful to return updated bias info right away
    _, _, explanation = brain.adjust_confidence(category=payload.category, raw_score=1.0)

    return {
        "ok": True,
        "market_id": payload.market_id,
        "category": payload.category,
        "action": action,
        "reason": payload.reason,
        "learning_state": explanation,
    }


@app.get("/latest/{market_id}")
def latest(market_id: str) -> Dict[str, Any]:
    """
    Fetch the latest recommendation object for a specific market_id.
    """
    if market_id not in _latest_by_market:
        raise HTTPException(status_code=404, detail="No recommendation found for that market_id")
    return _latest_by_market[market_id]


@app.get("/events", response_model=EventsOut)
def events(user_id: Optional[str] = None, event_type: Optional[str] = None, limit: int = 50) -> EventsOut:
    """
    Read recent events from the JSONL store.
    Great for your frontend live terminal.
    """
    all_events = store.load_events(user_id=user_id, event_type=event_type)
    all_events = all_events[-max(1, min(limit, 500)):]
    return EventsOut(events=all_events)


@app.post("/reset")
def reset() -> Dict[str, Any]:
    """
    Wipes the event log and in-memory recommendations.
    Useful before demos.
    """
    store.reset()
    _latest_by_market.clear()
    return {"ok": True}


@app.get("/stats")
def stats(user_id: str = "merchant_demo") -> Dict[str, Any]:
    """
    Simple insights view for your demo.
    Returns per-category rejection rates from merchant_feedback events.
    """
    stats = brain.learning.category_stats(user_id)
    out = {}
    for cat, s in stats.items():
        out[cat] = {
            "total": s.total,
            "rejected": s.rejected,
            "rejection_rate": round(s.rejection_rate, 4),
        }
    return {"user_id": user_id, "categories": out}
