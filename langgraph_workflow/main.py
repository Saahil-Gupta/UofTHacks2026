from os import getenv
from typing import TypedDict

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph

load_dotenv()

class State(TypedDict):
    polymarket_data: dict      # Input: market_name, market_type, market_value
    classification: dict       # Agent 1: shoppability classification
    ideas: list                # Agent 2a: multiple product ideas
    selected_idea: dict        # Agent 2b: filtered and ranked top idea
    product_metadata: dict     # Agent 3a: name, description, price
    image_prompt: dict         # Agent 3b: prompt for image generation

def load_instructions(file) -> str:
    with open(file, 'r') as f:
        return f.read()
    

def agent1(state: State) -> State:
    """
    This agent classifies whether the polymarket data can be turned into a 
    shoppable product idea.
    """
    instructions = load_instructions('instructions/agent1.md')
