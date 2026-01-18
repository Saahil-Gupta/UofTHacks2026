from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class Market(BaseModel):
    market_id: str
    market_name: str
    market_type: str
    market_values: Dict[str, float]  # {"Yes": 0.73, "No": 0.27}

    @property
    def top_prob(self) -> float:
        return max(self.market_values.values()) if self.market_values else 0.0


class OracleOut(BaseModel):
    shoppable: bool
    reason: str
    category: str


class ProductIdea(BaseModel):
    idea_id: str
    title: str
    description: str
    tags: List[str] = Field(default_factory=list)


class RiskScore(BaseModel):
    idea_id: str
    allowed: bool
    score: int = Field(ge=0, le=100)
    flags: List[str] = Field(default_factory=list)
    notes: str = ""


class FinalProduct(BaseModel):
    idea_id: str
    title: str
    price: float = Field(ge=0.0)
    description: str
    tags: List[str] = Field(default_factory=list)
    image_prompt: str
    image_data_url: Optional[str] = None


class GraphState(BaseModel):
    market: Market
    threshold: float = 0.70

    prefilter_passed: bool = False
    oracle: Optional[OracleOut] = None

    ideas: List[ProductIdea] = Field(default_factory=list)
    risk: List[RiskScore] = Field(default_factory=list)
    final_products: List[FinalProduct] = Field(default_factory=list)

    log: List[str] = Field(default_factory=list)
