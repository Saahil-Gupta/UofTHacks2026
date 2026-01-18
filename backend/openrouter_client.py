from __future__ import annotations

import os
import json
from typing import Any, Dict, Optional
import requests
import base64
import uuid
from pathlib import Path

def _base_headers() -> Dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
        "X-Title": os.getenv("OPENROUTER_APP_NAME", "Prophet-UofTHacks2026"),
    }
    return headers

def call_json(model: str, system: str, user: str) -> Dict[str, Any]:
    """
    Uses OpenRouter via OpenAI-compatible chat completions. :contentReference[oaicite:2]{index=2}
    """
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    url = f"{base_url}/chat/completions"
    headers = _base_headers()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    r = requests.post(url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    resp = r.json()
    # choices[0].message.content expected to be a JSON string
    content = resp.get("choices", [])[0].get("message", {}).get("content") or "{}"
    return json.loads(content)

def call_image_data_url(model: str, prompt: str) -> str:
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    url = f"{base_url}/chat/completions"
    headers = _base_headers()
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        # ask for image modality
        "modalities": ["image", "text"],
    }

    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    resp = r.json()

    choice = resp.get("choices", [])[0]
    msg = choice.get("message", {})
    images = msg.get("images") or msg.get("content", {}).get("images")
    if not images:
        raise RuntimeError("No images returned. Model may not support image output.")

    first = images[0]
    # support either nested dict or direct url
    if isinstance(first, dict):
        # OpenRouter returns {'image_url': {'url': '...'}} sometimes
        if "image_url" in first:
            return first["image_url"].get("url")
        # or {'url': '...'}
        return first.get("url")

    # if string, return directly
    return str(first)

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
