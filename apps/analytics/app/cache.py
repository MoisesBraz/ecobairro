from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import redis as redis_lib

from .config import get_settings


@lru_cache(maxsize=4)
def _client(url: str) -> redis_lib.Redis:
    return redis_lib.Redis.from_url(
        url, socket_connect_timeout=0.5, socket_timeout=0.5
    )


def _redis() -> redis_lib.Redis | None:
    """Cliente Redis se REDIS_URL estiver definida, senão None (cache desligada).

    Sem Redis (ex.: testes) ou com Redis indisponível, a cache é um no-op transparente:
    os endpoints respondem na mesma a partir da BD.
    """
    url = get_settings().redis_url
    if not url:
        return None
    try:
        return _client(url)
    except Exception:
        return None


def cache_key(prefix: str, params: dict[str, Any]) -> str:
    parts = [f"{k}={params[k]}" for k in sorted(params) if params[k] is not None]
    base = f"analytics:{prefix}"
    return f"{base}:" + "&".join(parts) if parts else base


def get_cached(key: str) -> Any | None:
    client = _redis()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def set_cached(key: str, value: Any, ttl: int) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.setex(key, ttl, json.dumps(value))
    except Exception:
        pass
