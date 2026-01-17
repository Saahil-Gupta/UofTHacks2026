from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator
from .agents.state import TrendOpportunity
from .agents.oracle import OracleAgent
from .agents.merchandiser import MerchandiserAgent
from .agents.marketer import MarketerAgent

# Initialize Agents
oracle = OracleAgent()
merchandiser = MerchandiserAgent()
marketer = MarketerAgent()

# Define Nodes
async def run_oracle(state: TrendOpportunity):
    # Oracle is usually the trigger, but here it might be part of the flow if we pass an empty state
    # For this flow, we assume we start with a list of opportunities found by Oracle
    # But to fit the graph:
    return state # Pass through if we feed opportunities directly

async def run_merchandiser(state: TrendOpportunity):
    return await merchandiser.generate_product_idea(state)

async def run_marketer(state: TrendOpportunity):
    return await marketer.generate_marketing_copy(state)

# Build Graph
workflow = StateGraph(TrendOpportunity)

workflow.add_node("merchandiser", run_merchandiser)
workflow.add_node("marketer", run_marketer)

# Flow: Merchandiser -> Marketer -> End
workflow.set_entry_point("merchandiser")
workflow.add_edge("merchandiser", "marketer")
workflow.add_edge("marketer", END)

app_graph = workflow.compile()
