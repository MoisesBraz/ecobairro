# Analytics (serviço FastAPI)

Serviço de **leituras analíticas e geoespaciais** (Python + FastAPI), conforme a
arquitetura CQRS-lite dos docs: o **NestJS escreve** no Postgres; este serviço **lê**
do mesmo Postgres+PostGIS e serve consultas geo/agregadas. Exposto via nginx em
`/analytics/` (`infra/nginx/nginx.dev.conf`).

## Estrutura

```text
apps/analytics/
  app/
    main.py            # FastAPI app + lifespan (abre/fecha pool); /health /ready
    config.py          # get_settings() — lê env (sem cache; testes mudam env)
    db.py              # ConnectionPool psycopg (init/close/get)
    auth.py            # verificação do JWT do NestJS + require_roles
    cache.py           # cache Redis (get/set JSON + TTL); no-op sem REDIS_URL
    routing.py         # motor de rotas OP4: haversine, osrm_trip (httpx), greedy
    routers/
      ecopontos.py     # GET /ecopontos/proximos (ST_DWithin)
      reports.py       # GET /reports/proximos (R2), /reports/duplicados (R8)
      operacional.py   # OP2 heatmap, OP3 fila-prioridades, R12 reports/kpis, OP4 rota-sugestao
  tests/
    conftest.py        # fixture: container postgis efémero (testcontainers) + seed
    constants.py       # JWT_SECRET, CENTER, SEED, REPORTS_SEED partilhados
    test_health.py     # unit (sem BD)
    test_proximos.py            # integração ecopontos (@pytest.mark.integration)
    test_reports_proximos.py    # integração R2
    test_reports_duplicados.py  # integração R8
    test_heatmap.py             # integração OP2
    test_fila.py                # integração OP3
    test_reports_kpis.py        # integração R12
    test_rota_sugestao.py       # OP4 (unit haversine/greedy + integração + fallback)
    test_cache.py               # cache Redis (fakeredis)
  requirements.txt / requirements-dev.txt
  Dockerfile           # CMD uvicorn (dev: compose sobrepõe com --reload)
  pytest.ini           # pythonpath=. ; testpaths=tests
```

## Convenções

- **Rotas SEM prefixo `/analytics`.** O nginx reescreve `^/analytics/(.*) → /$1`, por
  isso o FastAPI define `/ecopontos/proximos`, não `/analytics/ecopontos/proximos`.
- **Auth = JWT do NestJS.** `app/auth.py` verifica o access token **HS256** com
  `JWT_ACCESS_SECRET` (mesma env do NestJS). Claims usados: `sub`, `role`. Defesa em
  profundidade: consulta a blacklist Redis `revoked_user:{sub}` (escrita pelo
  `SecurityService` do NestJS) se `REDIS_URL` estiver definida — sem Redis, não bloqueia
  (o JwtAuthGuard do NestJS continua a ser o gate primário). `require_roles('GESTOR',
  'ADMIN')` para endpoints de gestão.
- **PostGIS correto.** Proximidade/distância sempre sobre `geography` (raio e distância
  em **metros**, não graus): `ST_DWithin(geom::geography, ponto::geography, raio)`. A
  coluna `ecopontos.geom` é gerada de `lng/lat` (ver migração
  `20260620120000_postgis_ecopontos_geom`) com índice GiST `ecopontos_geom_gist`.
- **SQL parametrizado.** Sempre binding psycopg (`%(...)s`); nunca interpolar strings.

## Variáveis de ambiente

- `DATABASE_URL` (obrigatória p/ `/ready` e queries) — mesmo Postgres do NestJS.
- `JWT_ACCESS_SECRET` (default dev `dev-access-secret-change-me`).
- `REDIS_URL` (opcional) — `redis://redis:6379/0` em compose.
- `OSRM_BASE_URL` (OP4) — servidor OSRM para o cálculo de rotas; default dev
  `http://osrm-car:5000` (self-hosted, grafo de Portugal construído pelo `osm-updater`).
  Em produção, o `.env` da máquina define o valor. Se o OSRM estiver indisponível, a
  rota cai no fallback greedy (linhas retas) e regista um `logger.warning`.

## Testes

```bash
# criar venv + instalar (este Python não traz ensurepip; usar o pip do sistema):
python3 -m venv .venv
python3 -m pip --python .venv/bin/python install -r requirements-dev.txt

.venv/bin/python -m pytest                 # unit + integração
.venv/bin/python -m pytest tests/test_health.py   # só unit (sem Docker)
.venv/bin/python -m pytest -m integration  # só integração (precisa de Docker)
```

Os testes de integração sobem um **Postgres+PostGIS descartável** (`testcontainers`,
imagem `postgis/postgis:16-3.4`), criam o mesmo DDL da migração (incl. `geom` gerada +
GiST) e validam `ST_DWithin` contra dados reais. Precisam de daemon Docker.

## Estado / próximas etapas

- **Feito (Etapa 1 — Fundações):** PostGIS ativo, `geom` gerada + GiST, serviço FastAPI
  com pool + auth partilhada, `GET /ecopontos/proximos`, harness de testes.
- **Feito (Etapa 2 — Proximidade cidadão):** `reports.lat/lng` + `geom` (migração
  `20260620130000_reports_geo`); criação de report no NestJS persiste coords (ambas ou
  nenhuma); `GET /reports/proximos` (R2 — abertos = PENDENTE/ANALISE) e
  `GET /reports/duplicados` (R8 — mesma categoria/`tipo` + raio dedup default 100 m +
  últimos 7 dias, devolve `{duplicado, candidatos}`).
- **Feito (Heatmap OP2):** `GET /operacional/heatmap?zona=` (GESTOR/ADMIN) — pontos de
  enchimento por ecoponto (geom→lat/lng, `peso`=ocupacao/100, faixas baixo/medio/alto) +
  `resumo` com `centro` (ST_Centroid(ST_Collect)) e `bbox` (ST_Extent). Sem telemetria, o
  enchimento/estado de cada ecoponto são **agregados dos `contentores`** (migração
  `20260621213121_contentores`): `ocupacao` = `MAX(contentores.ocupacao)`, `sensor_estado` =
  pior estado (offline > alerta > online). OP2/OP3/OP4 partilham esta agregação.
- **Feito (Fila-prioridades OP3):** `GET /operacional/fila-prioridades?zona=&limit=`
  (GESTOR/ADMIN) — ecopontos ativos ordenados por urgência. Sem telemetria, o score deriva
  do enchimento + estado do sensor: `score = ocupacao + peso(sensor_estado)` (offline +40,
  alerta +20). Score/ordenação/limite feitos na BD; `motivo` derivado para a UI.
- **Feito (Cache Redis):** os endpoints operacionais (heatmap 120 s, fila-prioridades 60 s,
  reports/kpis 900 s) servem de cache Redis por chave (`analytics:<prefixo>:<params>`).
  Sem `REDIS_URL` a cache é no-op transparente (BD na mesma). `app/cache.py`. Auth/role são
  verificados **antes** da cache (cache hit não contorna o gate).
- **Feito (KPIs de reports R12):** `GET /operacional/reports/kpis?de=&ate=` (GESTOR/ADMIN)
  — total + por_estado + taxa_resolucao + tempo_medio_resolucao_horas
  (`atualizado_em - criado_em` dos RESOLVIDO — aproximação até haver histórico de estados),
  `por_categoria` (tipo) e `por_zona` (atribui cada report georreferenciado à zona do
  ecoponto mais próximo via KNN `<->`). Reports sem coords ficam fora do `por_zona`.
- **Feito (Rota-sugestão OP4 — RF-05):** `GET /operacional/rota-sugestao?zona=&veiculo_lat=
  &veiculo_lng=&limiar=&limit=` (GESTOR/ADMIN). Seleciona os ecopontos que precisam de
  recolha (mesmo score da fila OP3 + filtro `ocupacao>=limiar OR sensor offline/alerta`,
  cap de 12) e resolve a ordem de visita + traçado por estradas via **OSRM `/trip`** (TSP,
  `app/routing.py`). Se o OSRM falhar (timeout/rede/erro), cai num **fallback greedy**
  (vizinho-mais-próximo por haversine, linhas retas) — nunca devolve mock; o campo `motor`
  (`osrm`|`greedy`) diz qual foi usado. **Sem cache** (depende da posição do veículo e do
  enchimento atual). Resposta em snake_case: `{ motor, zona, distancia_m, duracao_s,
  distancia_label, duracao_label, paragens:[{id,nome,lat,lng,ocupacao,ordem}], geometria }`.
  O NestJS persiste o resultado via `POST /v1/rotas`.
- **A seguir:** telemetria real (`sensor_leituras`, ingestão NestJS T1/T2/T3 — **adiada**),
  export CSV/XLSX, OSRM self-hosted (perfil driving, extract Portugal), `POST /v1/rotas`
  recalcular server-to-server (não confiar na geometria do cliente), zona (write side).
  Ver `~/.claude/plans/sorted-marinating-storm.md`.

## Notas

- `reports/duplicados` mapeia o param `categoria` ao campo `tipo` do report (o schema real
  usa `tipo`, não `categoria`). Reports antigos sem coords têm `geom` NULL → ficam fora.
- O frontend de criação de report ainda **não** envia lat/lng (campo opcional no backend);
  ligar quando houver picker de mapa.

## Linkagens

- Auth NestJS: `apps/api/src/auth/` (assinatura do token, `JwtAuthGuard`) e
  `apps/api/src/security/security.service.ts` (chave `revoked_user:{id}`).
- Analytics NestJS (KPIs de reports, mantido): `apps/api/src/analytics/`.
- Migração PostGIS: `apps/api/prisma/migrations/20260620120000_postgis_ecopontos_geom/`.
