from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from psycopg.rows import dict_row

from ..auth import AuthContext, require_roles
from ..cache import cache_key, get_cached, set_cached
from ..config import get_settings
from ..db import get_pool
from ..routing import distancia_label, duracao_label, greedy_route, osrm_trip

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/operacional", tags=["operacional"])

# TTLs de cache (segundos), alinhados com os docs (heatmap 2 min, fila ~1 min, kpis 15 min).
_TTL_HEATMAP = 120
_TTL_FILA = 60
_TTL_KPIS = 900

# Faixas de enchimento (RF-05): baixo < 50, médio 50-79, alto >= 80.
_FAIXA_ALTO = 80
_FAIXA_MEDIO = 50

# Pontos do heatmap — enchimento por ecoponto. ST_X/ST_Y extraem lng/lat da geom PostGIS.
# O enchimento/estado vivem nos contentores (1 ecoponto → N contentores em níveis
# diferentes): a ocupação do ecoponto é o MAX dos contentores e o estado é o pior
# (offline > alerta > online), igual à lógica de nível do NestJS (`computeNivel`).
_PONTOS_SQL = """
    SELECT e.id::text AS id,
           e.nome,
           COALESCE(e.zona, 'Sem zona') AS zona,
           COALESCE(MAX(c.ocupacao), 0) AS ocupacao,
           CASE
               WHEN bool_or(c.sensor_estado = 'offline') THEN 'offline'
               WHEN bool_or(c.sensor_estado = 'alerta')  THEN 'alerta'
               ELSE 'online'
           END AS sensor_estado,
           ST_Y(e.geom) AS lat,
           ST_X(e.geom) AS lng
    FROM ecopontos e
    LEFT JOIN contentores c ON c.ecoponto_id = e.id
    WHERE e.ativo = true
      AND e.geom IS NOT NULL
      AND (%(zona)s::text IS NULL OR e.zona = %(zona)s::text)
    GROUP BY e.id
    ORDER BY ocupacao DESC
"""

# Agregado geo (centro + bbox) para o frontend centrar/ajustar o mapa.
# ST_Collect junta os pontos; ST_Centroid dá o centro; ST_Extent dá a caixa envolvente.
_AGG_SQL = """
    SELECT ST_Y(ST_Centroid(ST_Collect(geom))) AS centro_lat,
           ST_X(ST_Centroid(ST_Collect(geom))) AS centro_lng,
           ST_XMin(ST_Extent(geom)) AS min_lng,
           ST_YMin(ST_Extent(geom)) AS min_lat,
           ST_XMax(ST_Extent(geom)) AS max_lng,
           ST_YMax(ST_Extent(geom)) AS max_lat
    FROM ecopontos
    WHERE ativo = true
      AND geom IS NOT NULL
      AND (%(zona)s::text IS NULL OR zona = %(zona)s::text)
"""


@router.get("/heatmap")
def heatmap(
    zona: str | None = Query(default=None, description="Filtrar por zona (texto)"),
    _user: AuthContext = Depends(require_roles("GESTOR", "ADMIN")),
) -> dict:
    key = cache_key("heatmap", {"zona": zona})
    cached = get_cached(key)
    if cached is not None:
        return cached

    params = {"zona": zona}
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_PONTOS_SQL, params)
            rows = cur.fetchall()
            cur.execute(_AGG_SQL, params)
            agg = cur.fetchone()

    faixas = {"baixo": 0, "medio": 0, "alto": 0}
    pontos = []
    for r in rows:
        ocupacao = int(r["ocupacao"])
        if ocupacao >= _FAIXA_ALTO:
            faixas["alto"] += 1
        elif ocupacao >= _FAIXA_MEDIO:
            faixas["medio"] += 1
        else:
            faixas["baixo"] += 1
        pontos.append(
            {
                "id": r["id"],
                "nome": r["nome"],
                "zona": r["zona"],
                "ocupacao": ocupacao,
                "sensor_estado": r["sensor_estado"],
                "lat": r["lat"],
                "lng": r["lng"],
                "peso": round(ocupacao / 100, 2),
            }
        )

    centro = None
    bbox = None
    if agg and agg["centro_lat"] is not None:
        centro = {"lat": agg["centro_lat"], "lng": agg["centro_lng"]}
        bbox = {
            "min_lat": agg["min_lat"],
            "min_lng": agg["min_lng"],
            "max_lat": agg["max_lat"],
            "max_lng": agg["max_lng"],
        }

    result = {
        "pontos": pontos,
        "resumo": {"total": len(pontos), "faixas": faixas, "centro": centro, "bbox": bbox},
    }
    set_cached(key, result, _TTL_HEATMAP)
    return result


# OP3 — fila de prioridades. Sem telemetria, a urgência deriva do enchimento e do estado
# do sensor: offline (não confiável, precisa de visita) e alerta pesam mais. O score e a
# ordenação são feitos na BD (ORDER BY + LIMIT) para não trazer ecopontos a mais.
#   score = ocupacao + peso(sensor_estado)
# Enchimento/estado agregados dos contentores (MAX da ocupação, pior estado, pior
# bateria); o score de urgência usa esses agregados.
_FILA_SQL = """
    SELECT e.id::text AS id,
           e.nome,
           COALESCE(e.zona, 'Sem zona') AS zona,
           COALESCE(MAX(c.ocupacao), 0) AS ocupacao,
           CASE
               WHEN bool_or(c.sensor_estado = 'offline') THEN 'offline'
               WHEN bool_or(c.sensor_estado = 'alerta')  THEN 'alerta'
               ELSE 'online'
           END AS sensor_estado,
           MIN(c.bateria) AS bateria,
           ST_Y(e.geom) AS lat,
           ST_X(e.geom) AS lng,
           (COALESCE(MAX(c.ocupacao), 0) + CASE
                         WHEN bool_or(c.sensor_estado = 'offline') THEN 40
                         WHEN bool_or(c.sensor_estado = 'alerta')  THEN 20
                         ELSE 0
                       END) AS score_prioridade
    FROM ecopontos e
    LEFT JOIN contentores c ON c.ecoponto_id = e.id
    WHERE e.ativo = true
      AND (%(zona)s::text IS NULL OR e.zona = %(zona)s::text)
    GROUP BY e.id
    ORDER BY score_prioridade DESC, ocupacao DESC, nome ASC
    LIMIT %(limit)s
"""


def _motivo(ocupacao: int, sensor_estado: str) -> str:
    if sensor_estado == "offline":
        return "sensor offline"
    if sensor_estado == "alerta":
        return "sensor em alerta"
    if ocupacao >= _FAIXA_ALTO:
        return "quase cheio"
    return "normal"


@router.get("/fila-prioridades")
def fila_prioridades(
    zona: str | None = Query(default=None, description="Filtrar por zona (texto)"),
    limit: int = Query(50, ge=1, le=200),
    _user: AuthContext = Depends(require_roles("GESTOR", "ADMIN")),
) -> list[dict]:
    key = cache_key("fila", {"zona": zona, "limit": limit})
    cached = get_cached(key)
    if cached is not None:
        return cached

    params = {"zona": zona, "limit": limit}
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_FILA_SQL, params)
            rows = cur.fetchall()

    result = [
        {
            "id": r["id"],
            "nome": r["nome"],
            "zona": r["zona"],
            "ocupacao": int(r["ocupacao"]),
            "sensor_estado": r["sensor_estado"],
            "bateria": r["bateria"],
            "lat": r["lat"],
            "lng": r["lng"],
            "score_prioridade": int(r["score_prioridade"]),
            "motivo": _motivo(int(r["ocupacao"]), r["sensor_estado"]),
        }
        for r in rows
    ]
    set_cached(key, result, _TTL_FILA)
    return result


# OP4 — sugestão de rota de recolha (RF-05). Seleciona, por zona, os ecopontos que
# precisam de visita (mesmo score de urgência da fila OP3) e resolve a ordem de visita
# por estradas (OSRM /trip). Sem telemetria, "precisa de recolha" = enchimento acima do
# limiar OU sensor offline/alerta. O enchimento/estado de cada ecoponto derivam dos seus
# contentores (MAX da ocupação, pior estado) — um ecoponto entra na rota se o contentor
# mais cheio passar o limiar. Cap de pontos para o /trip ser rápido e exato.
_ROTA_MAX_PONTOS = 12
_ROTA_SQL = """
    WITH agg AS (
        SELECT e.id,
               e.nome,
               COALESCE(MAX(c.ocupacao), 0) AS ocupacao,
               CASE
                   WHEN bool_or(c.sensor_estado = 'offline') THEN 'offline'
                   WHEN bool_or(c.sensor_estado = 'alerta')  THEN 'alerta'
                   ELSE 'online'
               END AS sensor_estado,
               json_agg(json_build_object('tipo', c.tipo, 'ocupacao', c.ocupacao))
                   FILTER (WHERE c.id IS NOT NULL) AS contentores,
               ST_Y(e.geom) AS lat,
               ST_X(e.geom) AS lng
        FROM ecopontos e
        LEFT JOIN contentores c ON c.ecoponto_id = e.id
        WHERE e.ativo = true
          AND e.geom IS NOT NULL
          AND (%(zona)s::text IS NULL OR e.zona = %(zona)s::text)
        GROUP BY e.id
    )
    SELECT id::text AS id,
           nome,
           ocupacao,
           lat,
           lng,
           contentores,
           (ocupacao + CASE sensor_estado
                         WHEN 'offline' THEN 40
                         WHEN 'alerta'  THEN 20
                         ELSE 0
                       END) AS score_prioridade
    FROM agg
    WHERE ocupacao >= %(limiar)s OR sensor_estado IN ('offline', 'alerta')
    ORDER BY score_prioridade DESC, ocupacao DESC, nome ASC
    LIMIT %(limit)s
"""


@router.get("/rota-sugestao")
def rota_sugestao(
    zona: str | None = Query(default=None, description="Filtrar por zona (texto)"),
    veiculo_lat: float | None = Query(default=None, ge=-90, le=90),
    veiculo_lng: float | None = Query(default=None, ge=-180, le=180),
    limiar: int = Query(60, ge=0, le=100, description="Enchimento mínimo p/ recolha"),
    limit: int = Query(_ROTA_MAX_PONTOS, ge=1, le=_ROTA_MAX_PONTOS),
    _user: AuthContext = Depends(require_roles("GESTOR", "ADMIN")),
) -> dict:
    # Sem cache: o cálculo depende da posição do veículo (dinâmica) e deve refletir o
    # enchimento atual dos ecopontos — segue o padrão dos endpoints de proximidade.
    params = {"zona": zona, "limiar": limiar, "limit": limit}
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_ROTA_SQL, params)
            rows = cur.fetchall()

    if not rows:
        return {
            "motor": "greedy",
            "zona": zona,
            "distancia_m": 0.0,
            "duracao_s": 0.0,
            "distancia_label": distancia_label(0.0),
            "duracao_label": duracao_label(0.0),
            "paragens": [],
            "geometria": [],
        }

    veiculo = (
        (veiculo_lat, veiculo_lng)
        if veiculo_lat is not None and veiculo_lng is not None
        else None
    )
    ecop_coords = [(float(r["lat"]), float(r["lng"])) for r in rows]
    coords = ([veiculo] if veiculo else []) + ecop_coords
    offset = 1 if veiculo else 0

    settings = get_settings()
    result = osrm_trip(
        coords, base_url=settings.osrm_base_url, source_first=veiculo is not None
    )
    if result is None:
        logger.warning(
            "OSRM indisponível (%s); a recorrer ao fallback greedy (linhas retas) p/ %d pontos",
            settings.osrm_base_url,
            len(coords),
        )
        result = greedy_route(coords, source_first=veiculo is not None)

    # Reconstruir as paragens (só ecopontos) pela ordem de visita; o índice do veículo
    # (quando presente) é o 0 e é ignorado.
    paragens = []
    for idx in result.ordem:
        if idx < offset:
            continue
        r = rows[idx - offset]
        paragens.append(
            {
                "id": r["id"],
                "nome": r["nome"],
                "lat": float(r["lat"]),
                "lng": float(r["lng"]),
                "ocupacao": int(r["ocupacao"]),
                "ordem": len(paragens) + 1,
                "contentores": [
                    {"tipo": c["tipo"], "ocupacao": int(c["ocupacao"])}
                    for c in (r["contentores"] or [])
                ],
            }
        )

    return {
        "motor": result.motor,
        "zona": zona,
        "distancia_m": round(result.distancia_m, 1),
        "duracao_s": round(result.duracao_s, 1),
        "distancia_label": distancia_label(result.distancia_m),
        "duracao_label": duracao_label(result.duracao_s),
        "paragens": paragens,
        "geometria": result.geometria,
    }


# R12 — KPIs de reports (RF-23). Filtro opcional por intervalo de datas (criado_em).
# O par de cláusulas `(%(x)s::date IS NULL OR ...)` torna os filtros opcionais sem
# concatenar SQL. Tempo de resolução = atualizado_em - criado_em para os RESOLVIDO.
# NOTA: atualizado_em é o updatedAt do Prisma (muda em qualquer alteração), pelo que o
# tempo de resolução é uma aproximação até existir um histórico de estados dedicado.
_DATE_FILTER = """
      AND (%(de)s::date IS NULL OR criado_em >= %(de)s::date)
      AND (%(ate)s::date IS NULL OR criado_em < (%(ate)s::date + 1))
"""

_KPIS_ESTADO_SQL = f"""
    SELECT status::text AS status, count(*)::int AS cnt
    FROM reports
    WHERE true {_DATE_FILTER}
    GROUP BY status
"""

_KPIS_TEMPO_SQL = f"""
    SELECT avg(extract(epoch FROM (atualizado_em - criado_em)))::float AS seg
    FROM reports
    WHERE status = 'RESOLVIDO' {_DATE_FILTER}
"""

_KPIS_CATEGORIA_SQL = f"""
    SELECT tipo,
           count(*)::int AS total,
           count(*) FILTER (WHERE status = 'RESOLVIDO')::int AS resolvidos,
           avg(extract(epoch FROM (atualizado_em - criado_em)))
               FILTER (WHERE status = 'RESOLVIDO')::float AS seg
    FROM reports
    WHERE true {_DATE_FILTER}
    GROUP BY tipo
    ORDER BY total DESC, tipo ASC
"""

# por_zona: atribui cada report georreferenciado à zona do ecoponto mais próximo
# (operador KNN <-> do PostGIS, suportado pelo índice GiST). Reports sem geom ficam fora.
_KPIS_ZONA_SQL = f"""
    SELECT z.zona AS zona,
           count(*)::int AS total,
           count(*) FILTER (WHERE r.status = 'RESOLVIDO')::int AS resolvidos
    FROM reports r
    JOIN LATERAL (
        SELECT COALESCE(e.zona, 'Sem zona') AS zona
        FROM ecopontos e
        WHERE e.geom IS NOT NULL
        ORDER BY e.geom <-> r.geom
        LIMIT 1
    ) z ON true
    WHERE r.geom IS NOT NULL {_DATE_FILTER.replace("criado_em", "r.criado_em")}
    GROUP BY z.zona
    ORDER BY total DESC, zona ASC
"""

_ESTADO_KEYS = {
    "PENDENTE": "pendente",
    "ANALISE": "analise",
    "RESOLVIDO": "resolvido",
    "REJEITADO": "rejeitado",
}


def _horas(seg: float | None) -> float | None:
    return round(seg / 3600, 2) if seg is not None else None


@router.get("/reports/kpis")
def reports_kpis(
    de: date | None = Query(default=None, description="Data inicial (criado_em >=)"),
    ate: date | None = Query(default=None, description="Data final inclusiva (criado_em <=)"),
    _user: AuthContext = Depends(require_roles("GESTOR", "ADMIN")),
) -> dict:
    key = cache_key("reports_kpis", {"de": de, "ate": ate})
    cached = get_cached(key)
    if cached is not None:
        return cached

    params = {"de": de, "ate": ate}
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_KPIS_ESTADO_SQL, params)
            estado_rows = cur.fetchall()
            cur.execute(_KPIS_TEMPO_SQL, params)
            tempo_seg = cur.fetchone()["seg"]
            cur.execute(_KPIS_CATEGORIA_SQL, params)
            categoria_rows = cur.fetchall()
            cur.execute(_KPIS_ZONA_SQL, params)
            zona_rows = cur.fetchall()

    por_estado = {"pendente": 0, "analise": 0, "resolvido": 0, "rejeitado": 0}
    for r in estado_rows:
        estado_key = _ESTADO_KEYS.get(r["status"])
        if estado_key:
            por_estado[estado_key] = r["cnt"]

    total = sum(por_estado.values())
    taxa = round(por_estado["resolvido"] / total * 100, 1) if total else 0.0

    result = {
        "periodo": {
            "de": de.isoformat() if de else None,
            "ate": ate.isoformat() if ate else None,
        },
        "kpis": {
            "total": total,
            "por_estado": por_estado,
            "taxa_resolucao": taxa,
            "tempo_medio_resolucao_horas": _horas(tempo_seg),
        },
        "por_categoria": [
            {
                "categoria": r["tipo"],
                "total": r["total"],
                "resolvidos": r["resolvidos"],
                "tempo_medio_horas": _horas(r["seg"]),
            }
            for r in categoria_rows
        ],
        "por_zona": [
            {"zona": r["zona"], "total": r["total"], "resolvidos": r["resolvidos"]}
            for r in zona_rows
        ],
    }
    set_cached(key, result, _TTL_KPIS)
    return result
