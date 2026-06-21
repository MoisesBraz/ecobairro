"""Cache Redis — unit (chave) + integração (hit/miss com fakeredis)."""
from __future__ import annotations

import json

import fakeredis
import jwt
import pytest
from fastapi.testclient import TestClient

from tests.constants import JWT_SECRET

pytestmark = pytest.mark.integration


def _auth(role: str = "GESTOR") -> dict[str, str]:
    token = jwt.encode({"sub": "u-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_cache_key_is_deterministic_and_sorted():
    from app.cache import cache_key

    assert cache_key("heatmap", {"zona": None}) == "analytics:heatmap"
    # Ordem dos params não importa; None é omitido.
    k1 = cache_key("fila", {"limit": 10, "zona": "Centro"})
    k2 = cache_key("fila", {"zona": "Centro", "limit": 10})
    assert k1 == k2 == "analytics:fila:limit=10&zona=Centro"


def _client_with_fake_redis(postgis_url, monkeypatch):
    fake = fakeredis.FakeRedis()
    # Substitui o factory do cliente Redis pela instância fake (ignora a URL).
    monkeypatch.setattr("app.cache._client", lambda url: fake)
    monkeypatch.setenv("DATABASE_URL", postgis_url)
    monkeypatch.setenv("JWT_ACCESS_SECRET", JWT_SECRET)
    monkeypatch.setenv("REDIS_URL", "redis://fake")  # truthy → cache ativa

    from app.main import app

    return fake, TestClient(app)


def test_heatmap_writes_then_reads_cache(postgis_url, monkeypatch):
    fake, tc = _client_with_fake_redis(postgis_url, monkeypatch)
    with tc as client:
        # 1.ª chamada (miss) → calcula e escreve na cache.
        r1 = client.get("/operacional/heatmap", headers=_auth())
        assert r1.status_code == 200
        assert r1.json()["resumo"]["total"] == 3

        keys = [k.decode() for k in fake.keys("analytics:heatmap*")]
        assert keys == ["analytics:heatmap"]

        # Substitui o valor em cache por um sentinela e confirma que a 2.ª chamada o lê.
        fake.setex(
            "analytics:heatmap",
            120,
            json.dumps({"pontos": [], "resumo": {"total": 999}}),
        )
        r2 = client.get("/operacional/heatmap", headers=_auth())
        assert r2.json()["resumo"]["total"] == 999  # servido da cache, não da BD


def test_kpis_and_fila_use_distinct_cache_keys(postgis_url, monkeypatch):
    fake, tc = _client_with_fake_redis(postgis_url, monkeypatch)
    with tc as client:
        client.get("/operacional/fila-prioridades", headers=_auth())
        client.get("/operacional/reports/kpis", headers=_auth())
        keys = {k.decode() for k in fake.keys("analytics:*")}
        assert "analytics:fila:limit=50" in keys
        assert "analytics:reports_kpis" in keys
