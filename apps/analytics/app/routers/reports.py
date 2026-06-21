from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from psycopg.rows import dict_row

from ..auth import AuthContext, current_user
from ..db import get_pool

router = APIRouter(prefix="/reports", tags=["reports"])

# "Abertos" = ainda por resolver (exclui RESOLVIDO/REJEITADO).
_OPEN_STATUSES = ("PENDENTE", "ANALISE")


def _row_to_report(r: dict) -> dict:
    return {
        "id": r["id"],
        "titulo": r["titulo"],
        "tipo": r["tipo"],
        "status": r["status"],
        "lat": r["lat"],
        "lng": r["lng"],
        "data": r["criado_em"].isoformat().replace("+00:00", "Z"),
        "distancia_m": round(float(r["distancia_m"]), 1),
    }


# R2 — reports abertos próximos de um ponto. ST_DWithin sobre geography → raio em metros.
_PROXIMOS_SQL = """
    SELECT id::text AS id, titulo, tipo, status::text AS status, lat, lng, criado_em,
           ST_Distance(
               geom::geography,
               ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography
           ) AS distancia_m
    FROM reports
    WHERE status = ANY(%(open)s)
      AND geom IS NOT NULL
      AND ST_DWithin(
              geom::geography,
              ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography,
              %(raio)s
          )
    ORDER BY distancia_m ASC
    LIMIT 100
"""


@router.get("/proximos")
def proximos(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    raio: float = Query(1000, gt=0, le=50000, description="Raio em metros"),
    _user: AuthContext = Depends(current_user),
) -> list[dict]:
    params = {"lat": lat, "lng": lng, "raio": raio, "open": list(_OPEN_STATUSES)}
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_PROXIMOS_SQL, params)
            rows = cur.fetchall()
    return [_row_to_report(r) for r in rows]


# R8 — possíveis duplicados antes de submeter: mesma categoria (tipo), abertos, dentro de
# um raio pequeno de dedup e nos últimos 7 dias. Serve para sugerir subscrever (não bloqueia).
_DUPLICADOS_SQL = """
    SELECT id::text AS id, titulo, tipo, status::text AS status, lat, lng, criado_em,
           ST_Distance(
               geom::geography,
               ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography
           ) AS distancia_m
    FROM reports
    WHERE tipo = %(categoria)s
      AND status = ANY(%(open)s)
      AND criado_em >= now() - interval '7 days'
      AND geom IS NOT NULL
      AND ST_DWithin(
              geom::geography,
              ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography,
              %(raio)s
          )
    ORDER BY distancia_m ASC
    LIMIT 20
"""


@router.get("/duplicados")
def duplicados(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    categoria: str = Query(..., min_length=1, description="Tipo/categoria do report"),
    raio: float = Query(100, gt=0, le=5000, description="Raio de dedup em metros"),
    _user: AuthContext = Depends(current_user),
) -> dict:
    params = {
        "lat": lat,
        "lng": lng,
        "raio": raio,
        "categoria": categoria,
        "open": list(_OPEN_STATUSES),
    }
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_DUPLICADOS_SQL, params)
            rows = cur.fetchall()
    duplicados_list = [_row_to_report(r) for r in rows]
    # `duplicado` sinaliza ao cliente que deve sugerir subscrever em vez de criar (RF-12).
    return {"duplicado": len(duplicados_list) > 0, "candidatos": duplicados_list}
