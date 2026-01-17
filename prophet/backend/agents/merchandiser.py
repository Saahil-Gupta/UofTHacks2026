from .state import TrendOpportunity
import random

class MerchandiserAgent:
    def __init__(self):
        self.products_catalog = [
            {"name": "Heavyweight Hoodie", "base_cost": 25.00},
            {"name": "Vintage Tee", "base_cost": 12.00},
            {"name": "Canvas Tote", "base_cost": 8.00},
            {"name": "Dad Hat", "base_cost": 10.00}
        ]

    async def generate_product_idea(self, opportunity: TrendOpportunity) -> TrendOpportunity:
        # Simulate LLM brainstorming
        event_name = opportunity["event"]
        category = opportunity["category"]
        
        # Simple heuristic for demo
        product = random.choice(self.products_catalog)
        
        design_concepts = [
            f"Minimalist text: '{event_name}'",
            f"Abstract art representing {category}",
            f"Retro graphic for {event_name}",
            "Bold typography statement"
        ]
        design = random.choice(design_concepts)
        
        opportunity["product_name"] = f"The '{event_name}' {product['name']}"
        opportunity["supplier_id"] = f"SUP-{random.randint(100, 999)}"
        opportunity["margin"] = "40%"
        opportunity["design_prompt"] = design
        
        log_entry = f"Merchandiser suggested '{opportunity['product_name']}' with design '{design}'"
        opportunity["logs"].append(log_entry)
        opportunity["status"] = "merchandised"
        
        return opportunity
    
    def run(self, state: TrendOpportunity) -> TrendOpportunity:
        # Wrapper for sync execution if needed, or async
        import asyncio
        return asyncio.run(self.generate_product_idea(state))
