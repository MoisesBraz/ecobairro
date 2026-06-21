"""Testes de integração — ST_DWithin contra um Postgres+PostGIS real."""
from __future__ import annotations

import jwt
import psycopg
import pytest

from tests.constants import CENTER, JWT_SECRET

pytestmark = pytest.mark.integration

LAT, LNG = CENTER


def _token(role: str = "CIDADAO", sub: str = "user-1") -> str:
    return jwt.encode({"sub": sub, "role": role}, JWT_SECRET, algorithm="HS256")


def _auth(role: str = "CIDADAO") -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(role)}"}


def test_proximos_includes_near_excludes_far_and_inactive(client):
    res = client.get(
        "/ecopontos/proximos",
        params={"lat": LAT, "lng": LNG, "raio": 1000},
        headers=_auth(),
    )
    assert res.status_code == 200
    nomes = [r["nome"] for r in res.json()]

    assert "Perto" in nomes      # ~200 m → dentro
    assert "Medio" in nomes      # ~500 m → dentro
    assert "Longe" not in nomes  # ~57 km → fora
    assert "Inativo" not in nomes  # dentro do raio mas ativo=false


def test_proximos_ordered_by_distance_ascending(client):
    res = client.get(
        "/ecopontos/proximos",
        params={"lat": LAT, "lng": LNG, "raio": 1000},
        headers=_auth(),
    )
    assert res.status_code == 200
    body = res.json()
    distancias = [r["distancia_m"] for r in body]
    assert distancias == sorted(distancias)
    # "Perto" deve vir antes de "Medio".
    assert body[0]["nome"] == "Perto"
    # Distância em metros plausível (não graus): ~200 m, com folga.
    assert 150 < body[0]["distancia_m"] < 300


def test_proximos_radius_in_metres(client):
    # Raio pequeno (250 m) deixa só o "Perto" (~200 m); "Medio" (~500 m) cai fora.
    res = client.get(
        "/ecopontos/proximos",
        params={"lat": LAT, "lng": LNG, "raio": 250},
        headers=_auth(),
    )
    assert res.status_code == 200
    nomes = [r["nome"] for r in res.json()]
    assert nomes == ["Perto"]


def test_proximos_requires_auth(client):
    res = client.get(
        "/ecopontos/proximos", params={"lat": LAT, "lng": LNG, "raio": 1000}
    )
    assert res.status_code == 401


def test_proximos_rejects_invalid_token(client):
    res = client.get(
        "/ecopontos/proximos",
        params={"lat": LAT, "lng": LNG, "raio": 1000},
        headers={"Authorization": "Bearer not-a-jwt"},
    )
    assert res.status_code == 401


def test_proximos_validates_coordinates(client):
    res = client.get(
        "/ecopontos/proximos",
        params={"lat": 999, "lng": LNG, "raio": 1000},
        headers=_auth(),
    )
    assert res.status_code == 422  # lat fora de [-90, 90]


def test_geom_generated_from_lat_lng(postgis_url):
    # Confirma que a coluna gerada deriva mesmo de lat/lng (ST_X = lng, ST_Y = lat).
    with psycopg.connect(postgis_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ST_X(geom), ST_Y(geom), lng, lat "
                "FROM ecopontos WHERE nome = %s",
                ("Perto",),
            )
            st_x, st_y, lng, lat = cur.fetchone()
    assert st_x == pytest.approx(lng)
    assert st_y == pytest.approx(lat)
