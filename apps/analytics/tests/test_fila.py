"""Integração OP3 — GET /operacional/fila-prioridades (ranking de urgência, GESTOR/ADMIN)."""
from __future__ import annotations

import jwt
import pytest

from tests.constants import JWT_SECRET

pytestmark = pytest.mark.integration


def _auth(role: str) -> dict[str, str]:
    token = jwt.encode({"sub": "u-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_fila_ranked_by_score(client):
    res = client.get("/operacional/fila-prioridades", headers=_auth("GESTOR"))
    assert res.status_code == 200
    body = res.json()

    # Ativos: Perto (90 + alerta 20 = 110), Longe (60), Medio (40). Inativo fora.
    nomes = [r["nome"] for r in body]
    assert nomes == ["Perto", "Longe", "Medio"]

    scores = [r["score_prioridade"] for r in body]
    assert scores == [110, 60, 40]
    assert scores == sorted(scores, reverse=True)

    perto = body[0]
    assert perto["motivo"] == "sensor em alerta"
    assert perto["lat"] == pytest.approx(40.6423)


def test_fila_filter_by_zona(client):
    body = client.get(
        "/operacional/fila-prioridades", params={"zona": "Centro"}, headers=_auth("ADMIN")
    ).json()
    assert [r["nome"] for r in body] == ["Perto", "Medio"]


def test_fila_respects_limit(client):
    body = client.get(
        "/operacional/fila-prioridades", params={"limit": 1}, headers=_auth("GESTOR")
    ).json()
    assert len(body) == 1
    assert body[0]["nome"] == "Perto"


def test_fila_forbidden_for_cidadao(client):
    res = client.get("/operacional/fila-prioridades", headers=_auth("CIDADAO"))
    assert res.status_code == 403


def test_fila_requires_auth(client):
    res = client.get("/operacional/fila-prioridades")
    assert res.status_code == 401


def test_fila_validates_limit(client):
    res = client.get(
        "/operacional/fila-prioridades", params={"limit": 0}, headers=_auth("GESTOR")
    )
    assert res.status_code == 422
