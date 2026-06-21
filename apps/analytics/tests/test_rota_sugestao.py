"""OP4 — GET /operacional/rota-sugestao + motor de cálculo (app/routing.py).

Unit (sem Docker): haversine + greedy. Integração (@integration): seleção por
zona/prioridade, ordem do OSRM (mockado) e fallback greedy.
"""
from __future__ import annotations

import jwt
import pytest

from app.routing import RouteResult, greedy_route, haversine_m
from tests.constants import JWT_SECRET

# ── Unit (não precisam de BD) ───────────────────────────────────────────────


def test_haversine_zero_for_same_point():
    assert haversine_m((40.64, -8.65), (40.64, -8.65)) == pytest.approx(0.0, abs=1e-6)


def test_haversine_known_distance():
    # ~1 grau de longitude no equador ≈ 111.3 km.
    d = haversine_m((0.0, 0.0), (0.0, 1.0))
    assert d == pytest.approx(111_195, rel=0.01)


def test_greedy_nearest_neighbour_order():
    # De (0,0): o mais próximo é (0,1), depois (0,2). Índice 0 é sempre a partida.
    coords = [(0.0, 0.0), (0.0, 2.0), (0.0, 1.0)]
    r = greedy_route(coords)
    assert r.motor == "greedy"
    assert r.ordem == [0, 2, 1]
    assert r.geometria == [[0.0, 0.0], [0.0, 1.0], [0.0, 2.0]]
    assert r.distancia_m == pytest.approx(
        haversine_m((0, 0), (0, 1)) + haversine_m((0, 1), (0, 2))
    )
    assert r.duracao_s > 0


def test_greedy_single_point():
    r = greedy_route([(40.64, -8.65)])
    assert r.ordem == [0]
    assert r.distancia_m == 0.0


# ── Integração (precisam de Docker) ─────────────────────────────────────────


def _auth(role: str) -> dict[str, str]:
    token = jwt.encode({"sub": "u-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
def test_rota_requires_manager(client):
    res = client.get("/operacional/rota-sugestao", headers=_auth("CIDADAO"))
    assert res.status_code == 403


@pytest.mark.integration
def test_rota_requires_auth(client):
    assert client.get("/operacional/rota-sugestao").status_code == 401


@pytest.mark.integration
def test_rota_empty_when_no_ecopontos(client):
    body = client.get(
        "/operacional/rota-sugestao",
        params={"zona": "Inexistente"},
        headers=_auth("GESTOR"),
    ).json()
    assert body["paragens"] == []
    assert body["geometria"] == []
    assert body["distancia_m"] == 0.0


@pytest.mark.integration
def test_rota_uses_osrm_order_when_available(client, monkeypatch):
    # limiar=0 → todos os ativos qualificam: rows por score = [Perto, Longe, Medio].
    fake = RouteResult(
        motor="osrm",
        distancia_m=1234.0,
        duracao_s=600.0,
        ordem=[2, 0, 1],  # Medio, Perto, Longe
        geometria=[[40.64, -8.65], [40.65, -8.65]],
    )
    monkeypatch.setattr(
        "app.routers.operacional.osrm_trip", lambda *a, **k: fake
    )

    body = client.get(
        "/operacional/rota-sugestao",
        params={"limiar": 0},
        headers=_auth("GESTOR"),
    ).json()

    assert body["motor"] == "osrm"
    assert [p["nome"] for p in body["paragens"]] == ["Medio", "Perto", "Longe"]
    assert [p["ordem"] for p in body["paragens"]] == [1, 2, 3]
    assert body["distancia_label"] == "1.2 km"
    assert body["duracao_label"] == "10 min"
    assert body["geometria"] == [[40.64, -8.65], [40.65, -8.65]]


@pytest.mark.integration
def test_rota_falls_back_to_greedy(client, monkeypatch):
    # OSRM indisponível → osrm_trip devolve None → greedy (vizinho mais próximo).
    monkeypatch.setattr("app.routers.operacional.osrm_trip", lambda *a, **k: None)

    body = client.get(
        "/operacional/rota-sugestao",
        params={"limiar": 0},
        headers=_auth("GESTOR"),
    ).json()

    assert body["motor"] == "greedy"
    # De Perto (maior score, índice 0): Medio é o mais próximo; Longe (~57 km) fica por último.
    assert [p["nome"] for p in body["paragens"]] == ["Perto", "Medio", "Longe"]
    assert body["distancia_m"] > 0


@pytest.mark.integration
def test_rota_filters_by_limiar_and_zona(client, monkeypatch):
    monkeypatch.setattr(
        "app.routers.operacional.osrm_trip", lambda *a, **k: None
    )
    # zona=Centro, limiar default 60 → só Perto (90/alerta); Medio (40/online) fica fora.
    body = client.get(
        "/operacional/rota-sugestao",
        params={"zona": "Centro"},
        headers=_auth("ADMIN"),
    ).json()
    assert [p["nome"] for p in body["paragens"]] == ["Perto"]
