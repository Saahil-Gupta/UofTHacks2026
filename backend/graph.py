from __future__ import annotations

from typing import Dict, Any, List
from langgraph.graph import StateGraph, END
from pathlib import Path
from backend.models import GraphState, OracleOut, ProductIdea, RiskScore, FinalProduct
from backend.openrouter_client import call_json, call_image_data_url, save_data_url
from backend.shopify_client import create_products

import os

def _log(state: GraphState, msg: str) -> GraphState:
    state.log.append(msg)
    return state

def node_prefilter(state: GraphState) -> Dict[str, Any]:
    passed = state.market.top_prob >= state.threshold
    msg = f"[PREFILTER] top_prob={state.market.top_prob:.2f} threshold={state.threshold:.2f} passed={passed}"
    return {"prefilter_passed": passed, "log": state.log + [msg]}

def route_after_prefilter(state: GraphState) -> str:
    return "oracle" if state.prefilter_passed else "stop"

def node_oracle_shoppable(state: GraphState) -> Dict[str, Any]:
    model = os.getenv("OR_TEXT_MODEL", "openai/gpt-4o-mini")

    system = (
        "You are Agent 1 Oracle. Decide if the market can be turned into shoppable products "
        "that are safe, non-sensitive, and sellable within 24 to 72 hours. "
        "Return JSON only with: shoppable (bool), reason (string), category (string). "
        "If sports, entertainment, or holiday event, set shoppable=true. "
        "If medical claims, violence, hate, or real-person likeness, set shoppable=false."
    )
    user = f"""
Market name: {state.market.market_name}
Market type: {state.market.market_type}
Market values: {state.market.market_values}

Return JSON only.
"""
    raw = call_json(model=model, system=system, user=user)
    out = OracleOut(**raw)

    msg = f"[ORACLE] shoppable={out.shoppable} category={out.category} reason={out.reason}"
    return {"oracle": out, "log": state.log + [msg]}

def route_after_oracle(state: GraphState) -> str:
    return "ideas" if state.oracle and state.oracle.shoppable else "stop"

def node_ideas(state: GraphState) -> Dict[str, Any]:
    model = os.getenv("OR_BRAINSTORM_MODEL", "openai/gpt-4o-mini")

    system = (
        "You are Agent 2 Merchandiser. Brainstorm 5 product ideas for a Shopify store. "
        "No trademarked logos, no copyrighted art, no direct celebrity name use. "
        "Return JSON only with: ideas: [{idea_id, title, description, tags[]}]. "
        "Use idea_id values i1..i5."
    )
    user = f"""
Event: {state.market.market_name}
Category: {state.oracle.category if state.oracle else state.market.market_type}

Give ideas that match the hype but stay generic and safe.
Return JSON only.
"""
    raw = call_json(model=model, system=system, user=user)
    ideas = [ProductIdea(**x) for x in raw.get("ideas", [])]

    msg = f"[IDEAS] generated={len(ideas)}"
    return {"ideas": ideas, "log": state.log + [msg]}

def node_risk(state: GraphState) -> Dict[str, Any]:
    model = os.getenv("OR_RISK_MODEL", "openai/gpt-4o-mini")

    system = (
        "You are Agent 3 Risk and Compliance. Score each idea 0-100 and decide allowed true or false. "
        "Flag: politics persuasion, medical claims, hate symbols, violence, adult content, IP infringement, real-person likeness. "
        "Return JSON only with: risk: [{idea_id, allowed, score, flags[], notes}]."
    )
    user = f"""
Market: {state.market.market_name}
Ideas: { [i.model_dump() for i in state.ideas] }

Return JSON only.
"""
    raw = call_json(model=model, system=system, user=user)
    risk = [RiskScore(**x) for x in raw.get("risk", [])]

    msg = f"[RISK] scored={len(risk)}"
    return {"risk": risk, "log": state.log + [msg]}

def node_build_products(state: GraphState) -> Dict[str, Any]:
    model = os.getenv("OR_PRODUCT_MODEL", "openai/gpt-4o-mini")

    # keep only allowed ideas, top 2 by score for image generation stability
    allow_map = {r.idea_id: r for r in state.risk if r.allowed}
    allowed_ideas = [i for i in state.ideas if i.idea_id in allow_map]
    allowed_ideas.sort(key=lambda i: allow_map[i.idea_id].score, reverse=True)
    allowed_ideas = allowed_ideas[:2]

    system = (
        "You are Agent 4 Product Builder. For each idea, produce title, price, description, tags and image_prompt. "
        "No brand names, no copyrighted logos, no celebrity names, no political messaging. "
        "Return JSON only with: products: [{idea_id, title, price, description, tags[], image_prompt}]."
    )
    user = f"""
Market: {state.market.market_name}
Category: {state.oracle.category if state.oracle else state.market.market_type}
Allowed ideas: { [i.model_dump() for i in allowed_ideas] }

Return JSON only.
"""
    raw = call_json(model=model, system=system, user=user)
    products = [FinalProduct(**x) for x in raw.get("products", [])]

    msg = f"[PRODUCTS] built={len(products)}"
    return {"final_products": products, "log": state.log + [msg]}

def node_images(state: GraphState) -> Dict[str, Any]:
    image_model = os.getenv("OR_IMAGE_MODEL", "black-forest-labs/flux.2-klein-4b")

    # same dir as app.py uses
    out_dir = Path(__file__).with_name("generated")

    updated: List[FinalProduct] = []
    for p in state.final_products:
        prompt = (
            "Generate a clean ecommerce product photo on a plain studio background. "
            "No logos, no text in the image, no real people, no celebrity likeness. "
            f"Product: {p.title}. Visual details: {p.image_prompt}"
        )

        data_url = call_image_data_url(model=image_model, prompt=prompt)
        local_url = save_data_url(data_url, out_dir=out_dir)

        p.image_data_url = local_url  # now small: "/generated/abc.png"
        updated.append(p)

    msg = f"[IMAGES] generated={len(updated)} model={image_model}"
    return {"final_products": updated, "log": state.log + [msg]}


def node_shopify(state: GraphState) -> Dict[str, Any]:
    payload = [p.model_dump() for p in state.final_products]
    result = create_products(payload)
    msg = f"[SHOPIFY] mode={result.get('mode')} created={len(result.get('created', []))} errors={len(result.get('errors', []))}"
    return {"shopify_result": result, "log": state.log + [msg]}

def node_stop(state: GraphState) -> Dict[str, Any]:
    return {"log": state.log + ["[STOP] ended early"]}

def build_graph():
    g = StateGraph(GraphState)

    g.add_node("prefilter", node_prefilter)
    g.add_node("oracle", node_oracle_shoppable)
    g.add_node("ideas", node_ideas)
    g.add_node("risk", node_risk)
    g.add_node("products", node_build_products)
    g.add_node("images", node_images)
    g.add_node("shopify", node_shopify)
    g.add_node("stop", node_stop)

    g.set_entry_point("prefilter")

    g.add_conditional_edges("prefilter", route_after_prefilter, {"oracle": "oracle", "stop": "stop"})
    g.add_conditional_edges("oracle", route_after_oracle, {"ideas": "ideas", "stop": "stop"})

    g.add_edge("ideas", "risk")
    g.add_edge("risk", "products")
    g.add_edge("products", "images")
    g.add_edge("images", "shopify")
    g.add_edge("shopify", END)
    g.add_edge("stop", END)

    return g.compile()
