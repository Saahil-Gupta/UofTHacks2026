from __future__ import annotations

import os
import json
from typing import Any, Dict, Optional
from openai import OpenAI
import base64
import uuid
from pathlib import Path

def _client() -> OpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY")

    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "Prophet-UofTHacks2026"),
        },
    )

def call_json(model: str, system: str, user: str) -> Dict[str, Any]:
    """
    Uses OpenRouter via OpenAI-compatible chat completions. :contentReference[oaicite:2]{index=2}
    """
    client = _client()
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = resp.choices[0].message.content or "{}"
    return json.loads(content)

def call_image_data_url(model: str, prompt: str) -> str:
    client = _client()

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        extra_body={"modalities": ["image", "text"]},
    )

    msg = resp.choices[0].message
    images = getattr(msg, "images", None)
    if not images:
        raise RuntimeError("No images returned. Model may not support image output.")

    # OpenRouter returns dict-like objects here
    first = images[0]
    return first["image_url"]["url"]

def save_data_url(data_url: str, out_dir: str | Path) -> str:
    """
    Saves a data URL (data:image/png;base64,...) to disk and returns a local URL path.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    header, b64 = data_url.split(",", 1)

    ext = "png"
    if "image/jpeg" in header:
        ext = "jpg"
    elif "image/webp" in header:
        ext = "webp"

    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = out_dir / filename

    file_path.write_bytes(base64.b64decode(b64))
    return f"/generated/{filename}"
