"""Integração R12 — GET /operacional/reports/kpis (KPIs de reports, GESTOR/ADMIN)."""
from __future__ import annotations

from datetime import date, timedelta

import jwt
import pytest

from tests.constants import JWT_SECRET

pytestmark = pytest.mark.integration


def _auth(role: str) -> dict[str, str]:
    token = jwt.encode({"sub": "u-1", "role": role}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_kpis_global(client):
    body = client.get("/operacional/reports/kpis", headers=_auth("GESTOR")).json()
    kpis = body["kpis"]

    assert kpis["total"] == 8
    assert kpis["por_estado"] == {
        "pendente": 5,
        "analise": 1,
        "resolvido": 2,
        "rejeitado": 0,
    }
    assert kpis["taxa_resolucao"] == 25.0  # 2/8
    # Resolvidos em 5 h e 15 h → média 10 h.
    assert kpis["tempo_medio_resolucao_horas"] == pytest.approx(10.0, abs=0.1)


def test_kpis_por_categoria(client):
    body = client.get("/operacional/reports/kpis", headers=_auth("ADMIN")).json()
    cats = {c["categoria"]: c for c in body["por_categoria"]}

    assert cats["Ecoponto Cheio"]["total"] == 7
    assert cats["Ecoponto Cheio"]["resolvidos"] == 2
    assert cats["Ecoponto Cheio"]["tempo_medio_horas"] == pytest.approx(10.0, abs=0.1)

    assert cats["Deposição Ilegal"]["total"] == 1
    assert cats["Deposição Ilegal"]["resolvidos"] == 0
    assert cats["Deposição Ilegal"]["tempo_medio_horas"] is None


def test_kpis_por_zona_via_knn(client):
    body = client.get("/operacional/reports/kpis", headers=_auth("GESTOR")).json()
    zonas = {z["zona"]: z for z in body["por_zona"]}

    # Reports junto a Aveiro → ecoponto mais próximo na zona Centro; "longe" → Norte.
    assert zonas["Centro"]["total"] == 7
    assert zonas["Norte"]["total"] == 1


def test_kpis_date_filter_excludes_old(client):
    de = (date.today() - timedelta(days=7)).isoformat()
    body = client.get(
        "/operacional/reports/kpis", params={"de": de}, headers=_auth("GESTOR")
    ).json()
    # "antigo" (10 dias) cai fora → 7 em vez de 8.
    assert body["kpis"]["total"] == 7
    assert body["periodo"]["de"] == de


def test_kpis_forbidden_for_cidadao(client):
    res = client.get("/operacional/reports/kpis", headers=_auth("CIDADAO"))
    assert res.status_code == 403


def test_kpis_requires_auth(client):
    res = client.get("/operacional/reports/kpis")
    assert res.status_code == 401


def test_kpis_rejects_bad_date(client):
    res = client.get(
        "/operacional/reports/kpis", params={"de": "not-a-date"}, headers=_auth("GESTOR")
    )
    assert res.status_code == 422
