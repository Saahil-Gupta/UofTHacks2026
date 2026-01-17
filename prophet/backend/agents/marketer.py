from .state import TrendOpportunity

class MarketerAgent:
    def __init__(self):
        pass

    async def generate_marketing_copy(self, opportunity: TrendOpportunity) -> TrendOpportunity:
        probability = opportunity["probability"]
        event = opportunity["event"]
        product = opportunity["product_name"]

        # Tone adjustment based on certainty
        if probability > 0.85:
            tone = "urgent and celebratory"
            subject_prefix = "It's finally here!"
        elif probability > 0.60:
            tone = "anticipatory"
            subject_prefix = "Get ready for..."
        else:
            tone = "speculative"
            subject_prefix = "What if..."

        # Simulate LLM generation
        opportunity["seo_description"] = f"Exclusive {product} celebrating {event}. Limited edition drop. Shop now for the best {opportunity['category']} merch."
        opportunity["email_subject"] = f"{subject_prefix} {event} Merch is Live!"
        opportunity["ad_copy"] = f"The odds are in. {event} is happening. Grab the {product} before it's gone. {tone.capitalize()} vibes only."
        
        log_entry = f"Hype-Man drafted '{opportunity['email_subject']}' email."
        opportunity["logs"].append(log_entry)
        opportunity["status"] = "marketed"
        
        return opportunity

    def run(self, state: TrendOpportunity) -> TrendOpportunity:
        import asyncio
        return asyncio.run(self.generate_marketing_copy(state))
