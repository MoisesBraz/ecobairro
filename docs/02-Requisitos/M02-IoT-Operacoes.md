# Módulo 2 — Sensores IoT e Operações (entidades gestoras)

> Parte de [[02-Requisitos]] · [[Home]]. Cobre RF-04 a RF-07. Convenção de prioridade: **Alta (A) / Média (M) / Baixa (B) / Futuro (F)**.

O motor de dados em tempo real: recebe **telemetria de enchimento** dos sensores, atualiza o estado dos ecopontos e oferece ao **Gestor** um dashboard operacional com mapa de calor, alertas por limiar e **sugestão de rotas**. — os casos de gestão passaram do antigo "Operador" para **Gestor**. O detalhe técnico do pipeline vive em [[models/IoT e Dispositivos/Init|Domínio IoT]].

## Atores envolvidos

| Ator | Papel neste módulo |
|------|--------------------|
| 📡 **Sensor IoT** | Envia telemetria (RF-04). Ator de sistema, autenticado por API key (HMAC). |
| 🧑‍💼 **Gestor** | Usa o dashboard operacional, gere zonas e planeia rotas (RF-05, RF-06). |
| 🛡️ **Admin** | Herda o Gestor; configura limiares e dispositivos. |

## Requisitos

| RF         | Prio. | Descrição                                                                                                                                                    | Critérios de aceitação                                                                                   |                |
| ---------- | :---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------- |
| **RF-04**  |   A   | **Ingestão de telemetria.** Recebe leituras de nível/estado dos sensores e associa-as ao ecoponto.                                                           | Leituras com **timestamp e origem**; **rejeita** leituras sem ID de ecoponto.                            |                |
| **RF-05**  |   A   | **Dashboard operacional (Gestor).** Mapa de calor de enchimento, alertas por limiar, fila de prioridades e **sugestão de rotas** (enchimento + proximidade). | Exportação CSV/XLSX; **registo de quem planeou/executou** a rota — ver [[02-Requisitos/M11-Frota-Equipas | RF-29/RF-30]]. |
| **RF-06**  |   M   | **Gestão de zonas operacionais (Gestor).** Administração de "zonas" (também usadas no anti-spam de reports).                                                 | Cada ecoponto pertence a **1 zona**; alteração **mantém histórico**.                                     |                |
| **RF-07**  |   F   | **Controlo de acesso/NFC.** Preparar entidade "dispositivo de acesso" (NFC/cartão) — modelo holandês.                                                        | **Sem ativação nesta fase.**                                                                             |                |

## Fluxograma — ingestão e dashboard operacional

```mermaid
flowchart TB
    IOT(["📡 Sensor IoT"])
    G(["🧑‍💼 Gestor"])

    subgraph ING["Ingestão (escrita)"]
        GW["NestJS — Gateway IoT<br/>auth HMAC · valida payload"]
        W["Worker BullMQ<br/>iot.ingest · threshold-check"]
    end

    subgraph LEIT["Operacional (leitura)"]
        FAST["FastAPI — heatmap · fila · rotas"]
    end

    subgraph DADOS["Dados"]
        PGP[("PG Primário<br/>sensor_leituras · estado_atual")]
        PGR[("PG Réplica")]
        REDIS[("Redis<br/>estado · device:auth · dashboard")]
    end

    IOT -->|"POST /iot/telemetria (202)"| GW
    GW -->|enfileira| REDIS
    REDIS -.->|consome| W
    W -->|INSERT leitura · UPSERT estado| PGP
    W -->|NOTIFY → DEL cache| REDIS
    W -->|"alerta por limiar"| ALERT["iot_alertas → notificação<br/>(push Gestor · SMS RF-27)"]

    PGP == replicação ==> PGR
    G --> FAST
    FAST -->|hit| REDIS
    FAST -->|miss| PGR

    classDef svc fill:#388E3C,color:#fff,stroke:#1B5E20;
    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    classDef cli fill:#C8E6C9,color:#000,stroke:#388E3C;
    class GW,W,FAST svc;
    class PGP,PGR,REDIS store;
    class IOT,G cli;
```

## Fluxo crítico — telemetria → estado (RF-04, ≤ 60 s)

```mermaid
sequenceDiagram
    autonumber
    participant S as Sensor IoT
    participant GW as NestJS Gateway
    participant R as Redis
    participant W as Worker (iot.ingest)
    participant PG as PG Primário
    participant WS as WS / Dashboard

    S->>GW: POST /iot/telemetria (X-Device-Key)
    GW->>R: GET device:auth:{id} (HMAC, TTL 5 min)
    alt key inválida ou device != ATIVO
        GW-->>S: 401 / 403 (+ alerta)
    else válido
        GW->>GW: valida ecoponto_id, timestamp, nível 0–100
        GW-->>S: 202 Accepted (não espera processamento)
        GW->>W: enfileira iot.ingest
        W->>PG: INSERT sensor_leituras
        W->>PG: UPSERT ecoponto_estado_atual
        PG-->>R: NOTIFY → DEL ecoponto + mapa:zona
        W->>WS: emit zona:{id} (heatmap atualizado)
        opt nível ≥ limiar_cheio
            W->>W: iot.threshold-check → INSERT iot_alertas
            W->>WS: push Gestor + SMS contactos (RF-27)
        end
    end
```

## Ciclo de vida — estado do ecoponto (pipeline IoT)

```mermaid
stateDiagram-v2
    [*] --> DISPONIVEL: 1.ª leitura válida
    DISPONIVEL --> CHEIO: nível ≥ limiar_cheio
    CHEIO --> DISPONIVEL: recolha / nível desce
    DISPONIVEL --> OFFLINE: sem heartbeat > timeout
    CHEIO --> OFFLINE: sem heartbeat > timeout
    OFFLINE --> DISPONIVEL: SENSOR_RECUPERADO
    DISPONIVEL --> AVARIADO: LEITURA_ANOMALA (Δ>50% em <5 min)
    AVARIADO --> DISPONIVEL: leitura válida
    note right of OFFLINE: offline-detector corre a cada 5 min
```

## Regras de negócio

- **Rejeição sem ecoponto (RF-04)** — payload sem `ecoponto_id` → `400`; a leitura é guardada com `valida=false` apenas para auditoria.
- **Autenticação O(1)** — com ~10.000 msg/min, a auth do dispositivo é cacheada em `device:auth:{id}` (TTL 5 min) para evitar uma query PG por leitura; invalidada na rotação de API key.
- **Limiar configurável por zona** — `zonas.alertas_config.limiar_cheio` (default 85%) determina a transição para `CHEIO`. Bateria <20% gera `BATERIA_FRACA`.
- **Histórico de zonas (RF-06)** — alterar a zona de um ecoponto mantém registo; cada ecoponto pertence sempre a exatamente **1 zona** (base do anti-spam de reports, [[02-Requisitos/M03-Reports|Módulo 3]]).
- **NFC (RF-07)** — apenas modelação preparatória; **sem endpoints ativos** nesta fase.

## Ver também

- [[03-Casos-de-Uso]] — pacote *IoT / Telemetria* e *Backoffice Operacional*
- [[02-Requisitos/M01-Mapa-Ecopontos|Módulo 1]] · [[02-Requisitos/M10-Acesso-Inclusivo-IoT|Módulo 10]] · [[02-Requisitos/M11-Frota-Equipas|Módulo 11]]
- [[models/IoT e Dispositivos/Init|Domínio IoT — pipeline completo]]
- [[06-Arquitetura]] · [[07-Modelo-de-Dados]]
