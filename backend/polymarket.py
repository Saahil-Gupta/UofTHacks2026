from __future__ import annotations

from typing import Dict, Any, List

def get_mock_markets() -> List[Dict[str, Any]]:
    # Hardcoded Polymarket-like data as you described
    return [
        {
            "market_id": "m1",
            "market_name": "Bitcoin hits $120k by March",
            "market_type": "Crypto",
            "market_values": {"Yes": 0.73, "No": 0.27},
        },
        {
            "market_id": "m2",
            "market_name": "Celebrity album surprise drop this month",
            "market_type": "Entertainment",
            "market_values": {"Yes": 0.78, "No": 0.22},
        },
        {
            "market_id": "m3",
            "market_name": "Team A wins championship",
            "market_type": "Sports",
            "market_values": {"Yes": 0.91, "No": 0.09},
        },
    ]
