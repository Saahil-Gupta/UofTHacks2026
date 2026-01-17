"""
Prophet Agents Module (Option A Analytics)

Agents:
1) OracleAgent
2) StrategistAgent
3) CuratorAgent

Analytics:
- market_signal_detected
- strategy_generated
- merchant_feedback (called by API route on button click)
"""

from __future__ import annotations

import os
import json
from enum import Enum
from typing import Dict, List, Any, Optional
from datetime import datetime

from .analytics import ProphetBrain

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("[AGENTS] anthropic not installed, using mock responses")


class AgentRole(Enum):
    ORACLE = "oracle"
    STRATEGIST = "strategist"
    CURATOR = "curator"


class BaseAgent:
    def __init__(self, role: AgentRole, model: str = "claude-sonnet-4-20250514"):
        self.role = role
        self.model = model
        self.client = None

        if ANTHROPIC_AVAILABLE:
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if api_key:
                self.client = Anthropic(api_key=api_key)
                print(f"[{self.role.value.upper()}] Connected to Claude API")
            else:
                print(f"[{self.role.value.upper()}] No ANTHROPIC_API_KEY set, using mock mode")

    def _call_claude(self, prompt: str, system: Optional[str] = None) -> str:
        if not self.client:
            return self._mock_response(prompt)

        try:
            messages = [{"role": "user", "content": prompt}]
            kwargs = {
                "model": self.model,
                "max_tokens": 1000,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system

            response = self.client.messages.create(**kwargs)
            return response.content[0].text

        except Exception as e:
            print(f"[{self.role.value.upper()}] Claude API error: {e}")
            return self._mock_response(prompt)

    def _mock_response(self, prompt: str) -> str:
        return f"[MOCK] Response to: {prompt[:80]}..."


def _safe_json_extract(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    raise ValueError("No valid JSON found")


class OracleAgent(BaseAgent):
    def __init__(self):
        super().__init__(role=AgentRole.ORACLE)
        self.system_prompt = """You are the Oracle Agent for Prophet.

Return JSON:
{
  "trend_description": "Brief description",
  "category": "Category name",
  "raw_confidence": 0.0-1.0,
  "reasoning": "Why this confidence level",
  "impact": "Potential impact for merchants",
  "tags": ["relevant", "tags"]
}
"""

    def analyze_market_signal(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        source = str(market_data.get("source", "Unknown"))
        title = market_data.get("title")
        signal = str(market_data.get("signal", title or ""))
        suggested_category = str(market_data.get("category", "Unknown"))
        raw_conf_default = float(market_data.get("confidence", 0.5))

        print(f"\n[ORACLE] Analyzing signal from {source}")
        print(f"[ORACLE] Signal: {signal}")

        prompt = f"""Analyze this prediction market signal:

Source: {source}
Signal: {signal}
Suggested Category: {suggested_category}

Market Data:
{json.dumps(market_data, indent=2)}

Return only JSON.
"""

        response = self._call_claude(prompt, system=self.system_prompt)

        try:
            analysis = _safe_json_extract(response)
        except Exception:
            analysis = {
                "trend_description": signal,
                "category": suggested_category,
                "raw_confidence": raw_conf_default,
                "reasoning": "Mock analysis for demo",
                "impact": "Potential engagement opportunity",
                "tags": [suggested_category.lower(), "trending"],
            }

        analysis["category"] = str(analysis.get("category", suggested_category))
        analysis["raw_confidence"] = float(analysis.get("raw_confidence", raw_conf_default))

        print(f"[ORACLE] Category: {analysis['category']}")
        print(f"[ORACLE] Raw Confidence: {analysis['raw_confidence']:.0%}")

        return analysis


class StrategistAgent(BaseAgent):
    def __init__(self):
        super().__init__(role=AgentRole.STRATEGIST)
        self.system_prompt = """You are the Strategist Agent for Prophet.

Return JSON:
{
  "strategy_name": "Catchy strategy name",
  "content_angle": "Main approach",
  "formats": ["video", "blog", "social"],
  "key_points": ["point 1", "point 2", "point 3"],
  "engagement_hooks": ["hook 1", "hook 2"],
  "tags": ["tag1", "tag2"],
  "estimated_effort": "low/medium/high",
  "timing": "when to publish"
}
"""

    def generate_strategy(
        self,
        trend_analysis: Dict[str, Any],
        merchant_preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        category = str(trend_analysis.get("category", "Unknown"))
        trend = str(trend_analysis.get("trend_description", ""))
        confidence = float(trend_analysis.get("raw_confidence", 0.5))

        print(f"\n[STRATEGIST] Generating strategy for {category}")

        prefs_block = ""
        if merchant_preferences:
            prefs_block = f"\nMerchant Preferences:\n{json.dumps(merchant_preferences, indent=2)}\n"

        prompt = f"""Generate a strategy:

Trend: {trend}
Category: {category}
Confidence: {confidence:.0%}
Impact: {trend_analysis.get('impact', 'Unknown')}

Trend Analysis:
{json.dumps(trend_analysis, indent=2)}
{prefs_block}

Return only JSON.
"""

        response = self._call_claude(prompt, system=self.system_prompt)

        try:
            strategy = _safe_json_extract(response)
        except Exception:
            strategy = {
                "strategy_name": f"{category} Trend Coverage",
                "content_angle": "Fast, practical take on the trend",
                "formats": ["short_video", "landing_page", "social_post"],
                "key_points": ["What happened", "Why it matters", "What to sell or highlight"],
                "engagement_hooks": [f"{category} is spiking, here is what it means"],
                "tags": trend_analysis.get("tags", [category.lower(), "trending"]),
                "estimated_effort": "medium",
                "timing": "immediate",
            }

        strategy["formats"] = list(strategy.get("formats", []))
        strategy["tags"] = list(strategy.get("tags", []))

        print(f"[STRATEGIST] Strategy: {strategy.get('strategy_name')}")
        return strategy


class CuratorAgent(BaseAgent):
    def __init__(self):
        super().__init__(role=AgentRole.CURATOR)
        self.system_prompt = """You are the Curator Agent for Prophet.

Decide publish monitor reject.

Return JSON:
{
  "decision": "publish/monitor/reject",
  "confidence_in_decision": 0.0-1.0,
  "reasoning": "Why",
  "risk_factors": ["factor1", "factor2"],
  "next_steps": "What happens next"
}
"""

    def make_decision(
        self,
        trend_analysis: Dict[str, Any],
        strategy: Dict[str, Any],
        adjusted_confidence: float,
        bias_explanation: str,
    ) -> Dict[str, Any]:
        category = str(trend_analysis.get("category", "Unknown"))

        print(f"\n[CURATOR] Deciding for {category}")
        print(f"[CURATOR] Adjusted confidence: {adjusted_confidence:.0%}")

        prompt = f"""Make a decision:

Adjusted Confidence: {adjusted_confidence:.0%}
Bias Explanation: {bias_explanation}

Trend Analysis:
{json.dumps(trend_analysis, indent=2)}

Strategy:
{json.dumps(strategy, indent=2)}

Return only JSON.
"""

        response = self._call_claude(prompt, system=self.system_prompt)

        try:
            decision = _safe_json_extract(response)
        except Exception:
            if adjusted_confidence >= 0.60:
                decision_type = "publish"
                reasoning = "High adjusted confidence and strong opportunity"
            elif adjusted_confidence >= 0.40:
                decision_type = "monitor"
                reasoning = "Medium confidence and wait for more confirmation"
            else:
                decision_type = "reject"
                reasoning = "Low confidence after bias and not worth acting"

            decision = {
                "decision": decision_type,
                "confidence_in_decision": float(adjusted_confidence),
                "reasoning": reasoning,
                "risk_factors": ["Trend reversal", "Mismatch with brand"],
                "next_steps": "Proceed" if decision_type == "publish" else "Watch" if decision_type == "monitor" else "Skip",
            }

        decision["decision"] = str(decision.get("decision", "monitor")).lower()

        print(f"[CURATOR] DECISION: {decision['decision'].upper()}")
        return decision


class AgentOrchestrator:
    """
    Full agent workflow with Option A analytics.

    Pipeline:
    1) Track market_signal_detected
    2) Oracle analysis
    3) Apply learning bias from merchant_feedback history
    4) Strategist generates strategy
    5) Curator decides publish monitor reject
    6) Track strategy_generated
    """

    def __init__(self):
        self.oracle = OracleAgent()
        self.strategist = StrategistAgent()
        self.curator = CuratorAgent()

        print("\n[ORCHESTRATOR] Agents initialized")

    def process_market_signal(self, market_data: Dict[str, Any], brain: ProphetBrain) -> Dict[str, Any]:
        market_id = str(market_data.get("market_id", "unknown_market"))
        source = str(market_data.get("source", "Polymarket"))
        title = market_data.get("title")
        volume_usd = market_data.get("volume_usd")
        suggested_category = str(market_data.get("category", "Unknown"))
        raw_conf_default = float(market_data.get("confidence", 0.5))

        print("\n" + "=" * 70)
        print("AGENT WORKFLOW STARTED")
        print("=" * 70)

        # Track input
        brain.track_market_signal(
            market_id=market_id,
            source=source,
            category=suggested_category,
            raw_confidence=raw_conf_default,
            title=title,
            volume_usd=float(volume_usd) if volume_usd is not None else None,
        )

        # Oracle
        trend_analysis = self.oracle.analyze_market_signal(market_data)

        # Learning bias
        adjusted_confidence, bias_multiplier, bias_explanation = brain.adjust_confidence(
            category=str(trend_analysis["category"]),
            raw_score=float(trend_analysis["raw_confidence"]),
        )

        merchant_prefs = {
            "category": str(trend_analysis["category"]),
            "bias_explanation": bias_explanation,
        }

        # Strategy
        strategy = self.strategist.generate_strategy(trend_analysis, merchant_preferences=merchant_prefs)

        # Decision
        curator_decision = self.curator.make_decision(
            trend_analysis=trend_analysis,
            strategy=strategy,
            adjusted_confidence=adjusted_confidence,
            bias_explanation=bias_explanation,
        )

        recommendation = curator_decision["decision"]
        proposed_tags = list(strategy.get("tags", []))

        # Track decision
        brain.track_strategy_generated(
            market_id=market_id,
            category=str(trend_analysis["category"]),
            raw_confidence=float(trend_analysis["raw_confidence"]),
            adjusted_confidence=float(adjusted_confidence),
            bias_multiplier=float(bias_multiplier),
            recommendation=recommendation,
            proposed_tags=proposed_tags,
            explanation=bias_explanation,
        )

        result = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "market_id": market_id,
            "market_signal": market_data,
            "oracle_analysis": trend_analysis,
            "raw_confidence": float(trend_analysis["raw_confidence"]),
            "adjusted_confidence": float(adjusted_confidence),
            "bias_multiplier": float(bias_multiplier),
            "bias_explanation": bias_explanation,
            "content_strategy": strategy,
            "final_decision": curator_decision,
            "recommendation": recommendation,
        }

        print("\n" + "=" * 70)
        print(f"WORKFLOW COMPLETE: {recommendation.upper()}")
        print("=" * 70 + "\n")

        return result


def demo_agents():
    """
    Local demo that shows the loop.
    Merchant feedback is simulated at the end.
    """

    brain = ProphetBrain(user_id="merchant_demo")
    orchestrator = AgentOrchestrator()

    market_signal = {
        "market_id": "pm_crypto_001",
        "source": "Polymarket",
        "title": "Bitcoin ETF approval odds rising",
        "signal": "Bitcoin ETF approval odds rising to 85%",
        "category": "Crypto",
        "confidence": 0.85,
        "volume_usd": 250000.0,
    }

    result = orchestrator.process_market_signal(market_signal, brain=brain)

    # Simulated merchant feedback (in the real app, call this from your API route)
    brain.process_merchant_feedback(
        market_id=result["market_id"],
        category=result["oracle_analysis"]["category"],
        action="reject",
        reason="Too volatile for our brand",
    )

    print("[DEMO] Done. Open events.jsonl to see the logged events.")


if __name__ == "__main__":
    demo_agents()
