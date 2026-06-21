"""Integração R8 — GET /reports/duplicados (mesma categoria + raio dedup + últimos 7 dias)."""
from __future__ import annotations

import jwt
import pytest

from tests.constants import CENTER, JWT_SECRET

pytestmark = pytest.mark.integration

LAT, LNG = CENTER
CATEGORIA = "Ecoponto Cheio"


def _auth(role: str = "CIDADAO") -> dict[str, str]:
    token = jwt.encode({"sub": "user-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_duplicados_finds_recent_same_category_nearby(client):
    # Raio default (100 m): só o "dup" (~44 m, EC, PENDENTE, hoje) qualifica.
    res = client.get(
        "/reports/duplicados",
        params={"lat": LAT, "lng": LNG, "categoria": CATEGORIA},
        headers=_auth(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["duplicado"] is True
    titulos = {c["titulo"] for c in body["candidatos"]}
    assert titulos == {"dup"}

    # Excluídos dentro de 100 m: resolvido (estado), outro_tipo (categoria), antigo (>7 dias).
    assert "resolvido" not in titulos
    assert "outro_tipo" not in titulos
    assert "antigo" not in titulos


def test_duplicados_false_when_far(client):
    # Local sem qualquer seed (Lisboa) → sem candidatos.
    res = client.get(
        "/reports/duplicados",
        params={"lat": 38.7223, "lng": -9.1393, "categoria": CATEGORIA},
        headers=_auth(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["duplicado"] is False
    assert body["candidatos"] == []


def test_duplicados_respects_other_category(client):
    res = client.get(
        "/reports/duplicados",
        params={"lat": LAT, "lng": LNG, "categoria": "Vandalismo"},
        headers=_auth(),
    )
    assert res.status_code == 200
    assert res.json()["duplicado"] is False


def test_duplicados_requires_categoria(client):
    res = client.get(
        "/reports/duplicados",
        params={"lat": LAT, "lng": LNG},
        headers=_auth(),
    )
    assert res.status_code == 422  # categoria obrigatória


def test_duplicados_requires_auth(client):
    res = client.get(
        "/reports/duplicados",
        params={"lat": LAT, "lng": LNG, "categoria": CATEGORIA},
    )
    assert res.status_code == 401
