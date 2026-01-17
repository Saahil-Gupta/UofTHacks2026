from typing import TypedDict, Optional, List, Dict, Any

class TrendOpportunity(TypedDict):
    event: str
    probability: float
    category: str
    # Merchandiser fields
    product_name: Optional[str]
    supplier_id: Optional[str]
    margin: Optional[str]
    design_prompt: Optional[str]
    # Hype-Man fields
    seo_description: Optional[str]
    email_subject: Optional[str]
    ad_copy: Optional[str]
    # Metadata
    logs: List[str]
    status: str # 'detected', 'merchandised', 'marketed', 'ready'
