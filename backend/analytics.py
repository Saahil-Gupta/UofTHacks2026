"""
Prophet Analytics Module (Option A: Local JSONL, Amplitude style)

What this gives you:
- Track events: market_signal_detected, strategy_generated, merchant_feedback
- Store in events.jsonl (one JSON per line)
- Learning loop: compute rejection rates per category and apply a bias multiplier
- Demo-friendly, zero external setup

Environment variables:
- PROPHET_EVENTS_PATH: path to JSONL file (default: events.jsonl)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

DEFAULT_EVENTS_PATH = os.getenv("PROPHET_EVENTS_PATH", "events.jsonl")


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


class AnalyticsStore:
    """
    Local event store that behaves like Amplitude style analytics tracking.
    Writes JSONL lines to disk and can load them back for simple analytics.
    """

    def __init__(self, path: str = DEFAULT_EVENTS_PATH):
        self.path = path

    def track(self, user_id: str, event_type: str, event_properties: Dict[str, Any]) -> None:
        event = {
            "timestamp": _now_iso(),
            "user_id": user_id,
            "event_type": event_type,
            "event_properties": event_properties,
        }
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")

        print(f"[EVENT] {event_type} {event_properties}")

    def load_events(
        self,
        user_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not os.path.exists(self.path):
            return []

        events: List[Dict[str, Any]] = []
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue

                if user_id and e.get("user_id") != user_id:
                    continue
                if event_type and e.get("event_type") != event_type:
                    continue
                events.append(e)

        return events

    def reset(self) -> None:
        if os.path.exists(self.path):
            os.remove(self.path)
        print(f"[ANALYTICS] Reset event log at {self.path}")


@dataclass
class CategoryStats:
    total: int = 0
    rejected: int = 0

    @property
    def rejection_rate(self) -> float:
        return (self.rejected / self.total) if self.total else 0.0


def calculate_learning_bias(rejection_rate: float, has_history: bool) -> Tuple[float, str]:
    """
    Converts a rejection rate into a confidence multiplier and label.

    - rejection_rate > 50%: 0.5x penalty
    - rejection_rate > 30%: 0.7x penalty
    - rejection_rate < 5%:  1.5x boost (only if has history)
    - rejection_rate < 10%: 1.2x boost (only if has history)
    else: 1.0x neutral
    """

    if not has_history:
        return 1.0, "no_history"

    if rejection_rate > 0.5:
        return 0.5, "heavy_penalty"
    if rejection_rate > 0.3:
        return 0.7, "moderate_penalty"
    if rejection_rate < 0.05:
        return 1.5, "strong_boost"
    if rejection_rate < 0.1:
        return 1.2, "moderate_boost"
    return 1.0, "neutral"


class LearningEngine:
    """
    Computes merchant preferences from merchant_feedback events.
    """

    def __init__(self, store: AnalyticsStore):
        self.store = store

    def category_stats(self, user_id: str) -> Dict[str, CategoryStats]:
        events = self.store.load_events(user_id=user_id, event_type="merchant_feedback")

        stats: Dict[str, CategoryStats] = defaultdict(CategoryStats)
        for e in events:
            props = e.get("event_properties", {})
            cat = props.get("category", "Unknown")
            action = props.get("action", "")

            stats[cat].total += 1
            if action == "reject":
                stats[cat].rejected += 1

        return stats

    def bias_for_category(self, user_id: str, category: str) -> Tuple[float, str, float, int]:
        stats = self.category_stats(user_id)
        cat_stats = stats.get(category, CategoryStats())

        has_history = cat_stats.total > 0
        rr = cat_stats.rejection_rate
        mult, label = calculate_learning_bias(rr, has_history)
        return mult, label, rr, cat_stats.total


class ProphetBrain:
    """
    Connects the analytics event stream to a learning bias that the agents can use.
    """

    def __init__(self, user_id: str, store: Optional[AnalyticsStore] = None, model_version: str = "v1.0"):
        self.user_id = user_id
        self.store = store or AnalyticsStore()
        self.learning = LearningEngine(self.store)
        self.model_version = model_version

    def adjust_confidence(self, category: str, raw_score: float) -> Tuple[float, float, str]:
        multiplier, label, rr, total = self.learning.bias_for_category(self.user_id, category)

        adjusted = raw_score * multiplier
        adjusted = max(0.0, min(1.0, adjusted))

        if total == 0:
            explanation = f"No history for {category} so no bias applied"
        else:
            explanation = f"{category} rejection_rate={rr:.0%} history={total} so bias={label} multiplier={multiplier}"

        return adjusted, multiplier, explanation

    def track_market_signal(
        self,
        market_id: str,
        source: str,
        category: str,
        raw_confidence: float,
        title: Optional[str] = None,
        volume_usd: Optional[float] = None,
    ) -> None:
        self.store.track(
            user_id=self.user_id,
            event_type="market_signal_detected",
            event_properties={
                "market_id": market_id,
                "source": source,
                "category": category,
                "raw_confidence": float(raw_confidence),
                "title": title,
                "volume_usd": float(volume_usd) if volume_usd is not None else None,
            },
        )

    def track_strategy_generated(
        self,
        market_id: str,
        category: str,
        raw_confidence: float,
        adjusted_confidence: float,
        bias_multiplier: float,
        recommendation: str,
        proposed_tags: List[str],
        explanation: str,
    ) -> None:
        self.store.track(
            user_id=self.user_id,
            event_type="strategy_generated",
            event_properties={
                "market_id": market_id,
                "model_version": self.model_version,
                "category": category,
                "raw_confidence": float(raw_confidence),
                "adjusted_confidence": float(adjusted_confidence),
                "bias_multiplier": float(bias_multiplier),
                "recommendation": recommendation,
                "proposed_tags_count": len(proposed_tags),
                "proposed_tags_sample": proposed_tags[:5],
                "explanation": explanation,
            },
        )

    def process_merchant_feedback(
        self,
        market_id: str,
        category: str,
        action: str,
        reason: Optional[str] = None,
    ) -> None:
        action = action.lower().strip()
        if action not in {"publish", "reject"}:
            raise ValueError('action must be "publish" or "reject"')

        self.store.track(
            user_id=self.user_id,
            event_type="merchant_feedback",
            event_properties={
                "market_id": market_id,
                "category": category,
                "action": action,
                "reason": reason or "No reason provided",
            },
        )


def seed_demo_feedback(store: AnalyticsStore, user_id: str) -> None:
    """
    Optional helper: seed a few feedback events so the bias is visible immediately in demos.
    """
    seeds = [
        ("Crypto", "reject"),
        ("Crypto", "reject"),
        ("Crypto", "reject"),
        ("Sports", "publish"),
        ("Sports", "publish"),
        ("Tech", "publish"),
        ("Politics", "reject"),
    ]
    for i, (cat, action) in enumerate(seeds):
        store.track(
            user_id=user_id,
            event_type="merchant_feedback",
            event_properties={
                "market_id": f"seed_{i}",
                "category": cat,
                "action": action,
                "reason": "seed",
            },
        )
    print("[ANALYTICS] Seeded demo feedback events")
