from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from psycopg.rows import dict_row

from ..auth import AuthContext, current_user
from ..db import get_pool

router = APIRouter(prefix="/ecopontos", tags=["ecopontos"])

# Proximidade sobre `geography` → ST_DWithin/ST_Distance dão raio e distância em METROS
# (não graus). O índice GiST (ecopontos_geom_gist) suporta o filtro ST_DWithin.
# Parâmetros sempre por binding (%(...)s) — nunca interpolação de strings (SQLi).
_PROXIMOS_SQL = """
    SELECT id::text AS id,
           nome,
           lat,
           lng,
           ST_Distance(
               geom::geography,
               ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography
           ) AS distancia_m
    FROM ecopontos
    WHERE ativo = true
      AND geom IS NOT NULL
      AND ST_DWithin(
              geom::geography,
              ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography,
              %(raio)s
          )
    ORDER BY distancia_m ASC
    LIMIT 50
"""


@router.get("/proximos")
def proximos(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    raio: float = Query(1000, gt=0, le=50000, description="Raio em metros"),
    _user: AuthContext = Depends(current_user),
) -> list[dict]:
    params = {"lat": lat, "lng": lng, "raio": raio}
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_PROXIMOS_SQL, params)
            rows = cur.fetchall()

    return [
        {
            "id": r["id"],
            "nome": r["nome"],
            "lat": r["lat"],
            "lng": r["lng"],
            "distancia_m": round(float(r["distancia_m"]), 1),
        }
        for r in rows
    ]
