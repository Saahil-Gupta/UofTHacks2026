from __future__ import annotations

from typing import Dict, Any, List

def get_mock_markets() -> List[Dict[str, Any]]:
    return [
        {
            "market_id": "m1",
            "market_name": "Bitcoin breaks $120k by March 2026",
            "market_type": "Crypto",
            "market_values": {"Yes": 0.72, "No": 0.28},
        },
        {
            "market_id": "m2",
            "market_name": "Taylor Swift announces a new album by June 2026",
            "market_type": "Entertainment",
            "market_values": {"Yes": 0.56, "No": 0.44},
        },
        {
            "market_id": "m3",
            "market_name": "Super Bowl LX drives a big watch party kit trend in early February 2026",
            "market_type": "Sports",
            "market_values": {"Yes": 0.82, "No": 0.18},
        },
        # NEW
        {
            "market_id": "m4",
            "market_name": "St. Patrick’s Day party supplies trend spikes in mid March 2026",
            "market_type": "Holiday",
            "market_values": {"Yes": 0.84, "No": 0.16},
        },
        {
            "market_id": "m5",
            "market_name": "Easter 2026 triggers a spring decor and brunch kit spike in early April",
            "market_type": "Holiday",
            "market_values": {"Yes": 0.79, "No": 0.21},
        },
        {
            "market_id": "m6",
            "market_name": "Mother’s Day gift bundles trend spikes in early May 2026",
            "market_type": "Holiday",
            "market_values": {"Yes": 0.88, "No": 0.12},
        },
    ]
