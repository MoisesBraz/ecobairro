"""Integração R2 — GET /reports/proximos (reports abertos próximos via ST_DWithin)."""
from __future__ import annotations

import jwt
import pytest

from tests.constants import CENTER, JWT_SECRET

pytestmark = pytest.mark.integration

LAT, LNG = CENTER


def _auth(role: str = "CIDADAO") -> dict[str, str]:
    token = jwt.encode({"sub": "user-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_proximos_returns_open_reports_within_radius(client):
    res = client.get(
        "/reports/proximos",
        params={"lat": LAT, "lng": LNG, "raio": 1000},
        headers=_auth(),
    )
    assert res.status_code == 200
    titulos = {r["titulo"] for r in res.json()}

    # Abertos (PENDENTE/ANALISE) dentro do raio, qualquer tipo/idade:
    assert {"dup", "perto", "analise", "outro_tipo", "antigo"} <= titulos
    # Resolvido e fora-de-raio excluídos:
    assert "resolvido" not in titulos
    assert "longe" not in titulos


def test_proximos_ordered_by_distance(client):
    res = client.get(
        "/reports/proximos",
        params={"lat": LAT, "lng": LNG, "raio": 1000},
        headers=_auth(),
    )
    body = res.json()
    distancias = [r["distancia_m"] for r in body]
    assert distancias == sorted(distancias)
    assert body[0]["titulo"] == "dup"  # ~44 m, o mais próximo


def test_proximos_requires_auth(client):
    res = client.get(
        "/reports/proximos", params={"lat": LAT, "lng": LNG, "raio": 1000}
    )
    assert res.status_code == 401
