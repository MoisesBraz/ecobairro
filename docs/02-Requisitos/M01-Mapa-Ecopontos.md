# Módulo 1 — Mapa de Ecopontos e Estado (geolocalização)

> Parte de [[02-Requisitos]] · [[Home]]. Cobre RF-01 a RF-03. Convenção de prioridade: **Alta (A) / Média (M) / Baixa (B) / Futuro (F)**.

O ponto de entrada do cidadão na app: um **mapa do concelho de Aveiro** com todos os ecopontos, a sua tipologia e o **estado em tempo real** (cheio / disponível / sem sensor), alimentado pela telemetria IoT ([[02-Requisitos/M02-IoT-Operacoes|Módulo 2]]). É o ecrã com maior exigência de performance (RNF-PERF-01/02), pelo que a leitura é servida pela **réplica + cache Redis**.

## Atores envolvidos

| Ator | Papel neste módulo |
|------|--------------------|
| 👤 **Cidadão** | Consulta o mapa, pesquisa por morada / "perto de mim", filtra e abre o detalhe do ecoponto. |
| 📡 **Sensor IoT** | Origem do estado de enchimento (indireto — ver [[02-Requisitos/M02-IoT-Operacoes|Módulo 2]]). |

## Requisitos

| RF | Prio. | Descrição | Critérios de aceitação |
|----|:----:|-----------|------------------------|
| **RF-01** | A | **Mapa de ecopontos.** Mostra todos os ecopontos do concelho com localização, tipologia (vidro/papel/embalagens/ORG/etc.) e **estado** (cheio / disponível / sem sensor). | Pesquisa por morada / "perto de mim"; lista dos **5 mais próximos**; estado sincronizado com sensores. |
| **RF-02** | A | **Detalhe do ecoponto.** Tipos aceites, horário, acessibilidade, data/hora da última leitura, botão "reportar problema". | Mostra o **timestamp** da atualização do estado. |
| **RF-03** | M | **Filtrar e navegar.** Filtros por material, estado e distância; iteração lista↔mapa. | ≥2 filtros aplicados em **<2 s** (RNF-PERF-02). |

## Fluxograma — consulta do mapa e detalhe

```mermaid
flowchart TB
    C(["👤 Cidadão"])

    subgraph APP["App (SPA)"]
        MAPA["Abrir Mapa / 'perto de mim'"]
        FILTRO["Aplicar filtros<br/>(material · estado · distância)"]
        DET["Abrir detalhe do ecoponto"]
    end

    subgraph APIS["Serviços"]
        FAST["FastAPI — leitura geoespacial<br/>ST_DWithin / ST_Within"]
        NEST["NestJS — detalhe + 'reportar problema'"]
    end

    subgraph DADOS["Dados"]
        REDIS[("Redis<br/>ecopontos:mapa:zona (2 min)")]
        PGR[("PG Réplica<br/>PostGIS + estado_atual")]
    end

    C --> MAPA --> FAST
    C --> FILTRO --> FAST
    FAST -->|cache hit| REDIS
    FAST -->|cache miss| PGR
    PGR -.->|popula| REDIS

    C --> DET --> NEST --> PGR
    DET -.->|"botão reportar"| REP["RF-08 · Criar Report<br/>(Módulo 3)"]

    classDef svc fill:#388E3C,color:#fff,stroke:#1B5E20;
    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    classDef cli fill:#C8E6C9,color:#000,stroke:#388E3C;
    class FAST,NEST svc;
    class REDIS,PGR store;
    class C cli;
```

## Fluxo crítico — "5 ecopontos mais próximos" (RF-01) e filtros <2 s (RF-03)

```mermaid
sequenceDiagram
    autonumber
    actor C as Cidadão
    participant APP as App (SPA)
    participant F as FastAPI
    participant R as Redis
    participant PG as PG Réplica (PostGIS)

    C->>APP: "perto de mim" (lat,lng) + filtros
    APP->>F: GET /ecopontos/proximos?lat&lng&raio&material&estado
    F->>R: GET ecopontos:mapa:zona:{id}
    alt cache hit
        R-->>F: lista de ecopontos + estado
    else cache miss
        F->>PG: ST_DWithin(localizacao, ponto, raio) + filtros
        PG-->>F: candidatos ordenados por distância
        F->>R: SET ecopontos:mapa:zona:{id} (TTL 2 min)
    end
    F-->>APP: top-5 por distância + estado (≤ 2 s)
    APP-->>C: render lista ↔ mapa sincronizado
```

## Ciclo de vida — estado do ecoponto (visível no mapa)

O estado mostrado deriva do pipeline IoT ([[02-Requisitos/M02-IoT-Operacoes|Módulo 2]]); aqui representa-se o que o cidadão vê.

```mermaid
stateDiagram-v2
    [*] --> SEM_SENSOR: ecoponto criado sem dispositivo
    SEM_SENSOR --> DISPONIVEL: dispositivo instalado + 1.ª leitura
    DISPONIVEL --> CHEIO: nível ≥ limiar_cheio (default 85%)
    CHEIO --> DISPONIVEL: nível < limiar / rota concluída
    DISPONIVEL --> OFFLINE: sem heartbeat > timeout
    CHEIO --> OFFLINE: sem heartbeat > timeout
    OFFLINE --> DISPONIVEL: sensor recupera
    DISPONIVEL --> AVARIADO: leitura inválida (anomalia)
    AVARIADO --> DISPONIVEL: leitura válida
```

## Regras de negócio

- **Estado servido por cache** — o estado de cada ecoponto é lido de `Redis` (`ecoponto:{id}` / `ecopontos:mapa:zona:{id}`) para cumprir o arranque <2 s e o primeiro render do mapa ≤3 s em 4G (RNF-PERF-01). O *miss* recorre à **réplica** PostGIS.
- **Proximidade** — `ST_DWithin(localizacao, ponto_ref, raio)` sobre índice GIST; a lista dos 5 mais próximos é ordenada por `ST_Distance`.
- **"Sem sensor" ≠ "Offline"** — ecoponto sem dispositivo apresenta-se como **SEM_SENSOR** (cinzento); um com dispositivo mas sem heartbeat recente é **OFFLINE** com data/hora da última leitura (RNF-CONF-02).
- **Ponte para reports** — o botão "reportar problema" do detalhe abre o fluxo de RF-08 já com `ecoponto_id` e geolocalização pré-preenchidos ([[02-Requisitos/M03-Reports|Módulo 3]]).

## Ver também

- [[03-Casos-de-Uso]] — pacote *Mapa e Ecopontos*
- [[02-Requisitos/M02-IoT-Operacoes|Módulo 2 — Sensores IoT]] · [[02-Requisitos/M03-Reports|Módulo 3 — Reports]]
- [[models/Ecopontos, Zonas, Badges e Quiz/Init|Domínio Ecopontos, Zonas, Badges e Quiz]]
- [[06-Arquitetura]] · [[07-Modelo-de-Dados]]
