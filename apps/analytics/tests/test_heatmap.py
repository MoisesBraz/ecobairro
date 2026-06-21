"""Integração OP2 — GET /operacional/heatmap (enchimento por ecoponto, GESTOR/ADMIN)."""
from __future__ import annotations

import jwt
import pytest

from tests.constants import JWT_SECRET

pytestmark = pytest.mark.integration


def _auth(role: str) -> dict[str, str]:
    token = jwt.encode({"sub": "u-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_heatmap_points_and_faixas(client):
    res = client.get("/operacional/heatmap", headers=_auth("GESTOR"))
    assert res.status_code == 200
    body = res.json()

    nomes = {p["nome"] for p in body["pontos"]}
    assert nomes == {"Perto", "Medio", "Longe"}  # só ativos (Inativo fora)

    resumo = body["resumo"]
    assert resumo["total"] == 3
    # Perto 90 → alto; Longe 60 → medio; Medio 40 → baixo.
    assert resumo["faixas"] == {"baixo": 1, "medio": 1, "alto": 1}

    perto = next(p for p in body["pontos"] if p["nome"] == "Perto")
    assert perto["peso"] == 0.9
    assert perto["sensor_estado"] == "alerta"
    # geom desempacotada para lat/lng reais.
    assert perto["lat"] == pytest.approx(40.6423)
    assert perto["lng"] == pytest.approx(-8.6538)


def test_heatmap_has_centro_and_bbox(client):
    body = client.get("/operacional/heatmap", headers=_auth("ADMIN")).json()
    resumo = body["resumo"]
    assert resumo["centro"] is not None
    bbox = resumo["bbox"]
    # bbox cobre de Aveiro (Perto/Medio) até ao ponto Norte (Longe ~41.15).
    assert bbox["min_lat"] == pytest.approx(40.6423)
    assert bbox["max_lat"] == pytest.approx(41.15)


def test_heatmap_filter_by_zona(client):
    centro = client.get(
        "/operacional/heatmap", params={"zona": "Centro"}, headers=_auth("GESTOR")
    ).json()
    assert {p["nome"] for p in centro["pontos"]} == {"Perto", "Medio"}

    norte = client.get(
        "/operacional/heatmap", params={"zona": "Norte"}, headers=_auth("GESTOR")
    ).json()
    assert {p["nome"] for p in norte["pontos"]} == {"Longe"}


def test_heatmap_empty_zona_has_null_centro(client):
    body = client.get(
        "/operacional/heatmap", params={"zona": "Inexistente"}, headers=_auth("GESTOR")
    ).json()
    assert body["resumo"]["total"] == 0
    assert body["resumo"]["centro"] is None
    assert body["resumo"]["bbox"] is None


def test_heatmap_forbidden_for_cidadao(client):
    res = client.get("/operacional/heatmap", headers=_auth("CIDADAO"))
    assert res.status_code == 403


def test_heatmap_requires_auth(client):
    res = client.get("/operacional/heatmap")
    assert res.status_code == 401
