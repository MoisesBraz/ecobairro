"""Motor de cálculo de rotas (OP4 — RF-05).

Calcula a ordem de visita (TSP) e o trajeto real por estradas chamando o serviço
público OSRM (`/trip`). Se o OSRM falhar (rede/timeout/erro), recorre a um
*fallback* `greedy` (vizinho-mais-próximo por distância linha-reta) — nunca devolve
dados mock. Coordenadas em toda a API são `(lat, lng)`; o OSRM usa `lng,lat`, pelo
que a conversão é feita aqui dentro.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import httpx

# Velocidade urbana média (km/h) para estimar a duração no fallback greedy.
_GREEDY_KMH = 30.0
# Timeout do OSRM: abaixo dos 10 s do RNF-PERF-04, com margem para o resto do pedido.
_OSRM_TIMEOUT_S = 8.0

Coord = tuple[float, float]  # (lat, lng)


@dataclass(frozen=True)
class RouteResult:
    """Resultado de um cálculo de rota.

    `ordem` são os índices dos `coords` de entrada pela ordem de visita (inclui o
    veículo de partida quando presente, no índice 0). `geometria` é o traçado a
    desenhar, em `[[lat, lng], ...]` — por estradas (OSRM) ou linhas retas (greedy).
    """

    motor: str  # "osrm" | "greedy"
    distancia_m: float
    duracao_s: float
    ordem: list[int]
    geometria: list[list[float]]


def haversine_m(a: Coord, b: Coord) -> float:
    """Distância linha-reta (great-circle) entre dois pontos `(lat, lng)`, em metros."""
    r = 6_371_000.0  # raio médio da Terra (m)
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def osrm_trip(
    coords: list[Coord],
    *,
    base_url: str,
    source_first: bool = False,
    timeout_s: float = _OSRM_TIMEOUT_S,
) -> RouteResult | None:
    """Resolve o TSP por estradas via OSRM `/trip`. Devolve `None` em qualquer falha.

    `source_first=True` fixa o primeiro ponto como partida (o veículo). O `/trip` é
    *roundtrip* (regressa ao início). Falha (timeout, rede, `code != "Ok"`, resposta
    inesperada) → `None`, para o chamador cair no fallback greedy.
    """
    if len(coords) < 2:
        return None

    pares = ";".join(f"{lng:.6f},{lat:.6f}" for (lat, lng) in coords)
    params = {
        "geometries": "geojson",
        "overview": "full",
        "roundtrip": "true",
    }
    if source_first:
        params["source"] = "first"

    try:
        resp = httpx.get(
            f"{base_url.rstrip('/')}/trip/v1/driving/{pares}",
            params=params,
            timeout=timeout_s,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    if data.get("code") != "Ok" or not data.get("trips") or not data.get("waypoints"):
        return None

    trip = data["trips"][0]
    waypoints = data["waypoints"]
    if len(waypoints) != len(coords):
        return None

    try:
        # waypoints está na ordem de entrada; `waypoint_index` é a posição na rota
        # otimizada. Ordenar os índices de entrada por essa posição dá a ordem de visita.
        ordem = sorted(range(len(waypoints)), key=lambda i: waypoints[i]["waypoint_index"])
        # GeoJSON vem em [lng, lat]; a API toda usa [lat, lng].
        geometria = [[lat, lng] for (lng, lat) in trip["geometry"]["coordinates"]]
        distancia_m = float(trip["distance"])
        duracao_s = float(trip["duration"])
    except (KeyError, TypeError, IndexError):
        return None

    return RouteResult(
        motor="osrm",
        distancia_m=distancia_m,
        duracao_s=duracao_s,
        ordem=ordem,
        geometria=geometria,
    )


def greedy_route(coords: list[Coord], *, source_first: bool = False) -> RouteResult:
    """Fallback determinístico: vizinho-mais-próximo por haversine, linhas retas.

    Parte do índice 0 (o veículo quando `source_first`, senão o ecoponto de maior
    prioridade) e escolhe sempre o ponto não visitado mais próximo. Duração estimada
    a partir de `_GREEDY_KMH`.
    """
    n = len(coords)
    if n == 0:
        return RouteResult("greedy", 0.0, 0.0, [], [])
    if n == 1:
        return RouteResult("greedy", 0.0, 0.0, [0], [list(coords[0])])

    por_visitar = set(range(n))
    atual = 0
    ordem = [atual]
    por_visitar.discard(atual)
    distancia_m = 0.0

    while por_visitar:
        prox = min(por_visitar, key=lambda i: haversine_m(coords[atual], coords[i]))
        distancia_m += haversine_m(coords[atual], coords[prox])
        ordem.append(prox)
        por_visitar.discard(prox)
        atual = prox

    geometria = [list(coords[i]) for i in ordem]
    duracao_s = distancia_m / (_GREEDY_KMH * 1000.0 / 3600.0)
    return RouteResult(
        motor="greedy",
        distancia_m=distancia_m,
        duracao_s=duracao_s,
        ordem=ordem,
        geometria=geometria,
    )


def distancia_label(metros: float) -> str:
    """Ex.: 8234.0 → "8.2 km"."""
    return f"{metros / 1000:.1f} km"


def duracao_label(segundos: float) -> str:
    """Ex.: 6300 → "1h 45min"; 2700 → "45 min"."""
    minutos = round(segundos / 60)
    horas, mins = divmod(minutos, 60)
    return f"{horas}h {mins:02d}min" if horas else f"{mins} min"
