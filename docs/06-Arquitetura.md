# 06 · Arquitetura

Arquitetura de software e dados do EcoBairro Digital. Separa **escrita operacional** (NestJS) de **leitura analítica** (FastAPI), com PostgreSQL em **primário + réplica** (PostGIS), Redis como cache/anti-spam e BullMQ para trabalho assíncrono. Migrado dos diagramas de `documentos/diagramas da arquitetura/` (NestJS Operational, FastAPI Analytical Engine, IoT Analytics Heatmap, Data Processing).

## Vista de componentes

```mermaid
flowchart TB
    subgraph CLIENTES["Clientes"]
        APP["App Web / Mobile<br/>Vite + React + TanStack (SPA)"]
        OPAPP["App de Terreno (Operador)<br/>rota do dia / visitas"]
        IOT["Sensores IoT<br/>(enchimento)"]
    end

    subgraph EDGE["Borda"]
        NGINX["Reverse Proxy / TLS 1.3"]
    end

    subgraph APIS["Serviços aplicacionais"]
        NEST["NestJS — API Operacional<br/>escrita, RBAC, gateway IoT (HTTP POST)"]
        FAST["FastAPI — Motor Analítico<br/>leitura, KPIs, proximidade, rotas sugeridas"]
        WORKER["Workers BullMQ<br/>triagem, notificações, fan-out, auditoria"]
    end

    subgraph DADOS["Dados"]
        PGP[("PostgreSQL Primário<br/>PostGIS — escrita")]
        PGR[("PostgreSQL Réplica<br/>leitura / analytics")]
        REDIS[("Redis<br/>cache + anti-spam + filas")]
    end

    APP --> NGINX
    OPAPP --> NGINX
    IOT -->|telemetria HTTP POST| NGINX
    NGINX --> NEST
    NGINX --> FAST

    NEST -->|escrita SQL| PGP
    NEST -->|NOTIFY / enfileira| REDIS
    NEST -->|cache invalidação| REDIS
    REDIS -.->|consome jobs| WORKER
    WORKER -->|"escrita assíncrona<br/>(auditoria, estado)"| PGP
    WORKER -->|push / email / SMS| APP
    WORKER -->|push / email / SMS| OPAPP

    PGP == replicação ==> PGR
    FAST -->|leitura SQL<br/>ST_DWithin, agregações| PGR
    FAST -->|cache de leitura| REDIS

    classDef svc fill:#388E3C,color:#fff,stroke:#1B5E20;
    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    classDef cli fill:#C8E6C9,color:#000,stroke:#388E3C;
    class NEST,FAST,WORKER svc;
    class PGP,PGR,REDIS store;
    class APP,OPAPP,IOT cli;
```

## Padrões de fluxo (resumo)

| Fluxo                  | Caminho                                         | Exemplo                                                       |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| **Escrita**            | NestJS → PG primário → NOTIFY/BullMQ            | `POST /reports` (anti-spam Redis → write → triagem)           |
| **Leitura rápida**     | NestJS → Redis → PG réplica                     | `GET /notificacoes/count` (Redis 5 min)                       |
| **Analytics**          | FastAPI → Redis → PG réplica                    | `GET /reports/proximos` (ST_DWithin), `GET /reports/kpis`     |
| **IoT**                | Sensor → NestJS gateway → PG → estado cacheado  | `POST` telemetria → UPSERT `ecoponto_estado_atual` (≤ 60 s)   |
| **Auditoria**          | Middleware NestJS → BullMQ → PG (append-only)   | toda a operação sensível → `INSERT audit_log`                 |
| **Operacional (novo)** | Gestor planeia → cria equipa → Operador executa | `POST /equipas` → `PATCH /rotas/:id/concluir` (UPSERT estado) |

## Decisões-chave

- **CQRS leve** — escrita no primário (NestJS), leitura/analytics na réplica (FastAPI), reduzindo contenção e cumprindo `RNF-PERF`.
- **PostGIS** — geometria de zonas (`MULTIPOLYGON`) e rotas (`LINESTRING`); proximidade via `ST_DWithin`.
- **Redis** — cache de estado dos ecopontos (mapa <2 s), contadores anti-spam (RF-09) e backend das filas BullMQ.
- **RBAC** em NestJS — `CIDADAO / OPERADOR / GESTOR / ADMIN` (RNF-SEG-02).

## Ver também

- [[07-Modelo-de-Dados]] — tabelas e relações
- [[_playbooks/08-api-implementation-playbook|Playbook da API NestJS]]
- [[_playbooks/06-frontend-scaffold|Scaffold do frontend]]
- [[models/IoT e Dispositivos/Init|Domínio IoT]]
