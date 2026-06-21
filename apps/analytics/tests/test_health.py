"""Testes unitários — não precisam de BD (surface de saúde + helpers)."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_utc_timestamp_uses_z_suffix():
    from app.main import utc_timestamp

    ts = utc_timestamp()
    assert ts.endswith("Z")
    assert "+00:00" not in ts


def test_build_payload_shape():
    from app.main import build_payload

    payload = build_payload("ok")
    assert payload["service"] == "analytics"
    assert payload["status"] == "ok"
    assert payload["dependencies"] == []
    assert "timestamp" in payload


def test_health_ok(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    from app.main import app

    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


def test_ready_503_when_db_unconfigured(monkeypatch):
    # Sem DATABASE_URL o pool não é iniciado e /ready reporta indisponível.
    monkeypatch.delenv("DATABASE_URL", raising=False)
    from app.main import app

    with TestClient(app) as client:
        res = client.get("/ready")
        assert res.status_code == 503
        body = res.json()
        assert body["status"] == "error"
        assert body["dependencies"][0]["status"] == "down"
