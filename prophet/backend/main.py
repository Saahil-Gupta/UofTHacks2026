from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import asyncio
from .agents.oracle import OracleAgent
from .graph import app_graph
from .agents.state import TrendOpportunity

app = FastAPI()

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oracle = OracleAgent()

# In-memory store for demo purposes
generated_opportunities: List[TrendOpportunity] = []

@app.get("/api/scan")
async def scan_market():
    """
    Triggers the Oracle to scan Polymarket and runs the agent chain for found opportunities.
    """
    global generated_opportunities
    
    # 1. Oracle finds opportunities
    raw_opportunities = await oracle.fetch_opportunities()
    
    processed_opps = []
    
    # 2. Run each opportunity through the Merchandiser -> Marketer graph
    for opp in raw_opportunities:
        # Run the graph
        # LangGraph invoke returns the final state
        final_state = await app_graph.ainvoke(opp)
        processed_opps.append(final_state)
    
    generated_opportunities = processed_opps
    return processed_opps

@app.get("/api/opportunities")
async def get_opportunities():
    return generated_opportunities

@app.post("/api/launch")
async def launch_drop(opportunity: TrendOpportunity):
    """
    Simulates the 'One-Click Drop' to Shopify.
    In a real app, this would use the Shopify Admin API to create a product.
    """
    # Mock Shopify API Call
    print(f"Creating product: {opportunity.get('product_name')}")
    print(f"Description: {opportunity.get('seo_description')}")
    
    # Simulate success
    return {"status": "success", "shopify_product_id": "gid://shopify/Product/123456789"}

@app.post("/api/track")
async def track_event(event_data: Dict):
    """
    Endpoint for Amplitude tracking.
    """
    event_type = event_data.get("event_type")
    properties = event_data.get("properties")
    print(f"[Amplitude Mock] Tracking {event_type}: {properties}")
    
    # Feedback loop logic (simple mock)
    if event_type == "opportunity_rejected":
        category = properties.get("category")
        print(f"[AI Loop] User rejected {category}. Adjusting Oracle filters...")
        # In a real app, we'd update a user_preference database here
        
    return {"status": "tracked"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
