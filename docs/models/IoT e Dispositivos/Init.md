> Parte de [[Home]] · [[07-Modelo-de-Dados]] · [[06-Arquitetura]]. Domínio IoT e dispositivos.
> Requisitos: [[02-Requisitos/M02-IoT-Operacoes|Módulo 2 — Sensores IoT e Operações]] · [[02-Requisitos/M10-Acesso-Inclusivo-IoT|Módulo 10 — Acesso inclusivo (IoT)]].

## Nota de contexto
Este documento cobre o domínio IoT completo: dispositivos físicos, ingestão de telemetria, pipeline de processamento, alertas, gestão de zonas prioritárias e o circuito de tolerância a falhas de sensores (RNF-CONF-02). Complementa os documentos anteriores — as tabelas `sensor_leituras` e `ecoponto_estado_atual` foram esboçadas anteriormente mas são aqui especificadas na íntegra com os campos em falta.

## 1.1 Schema PostgreSQL — `iot_dispositivos`
O dispositivo é a entidade física: o sensor instalado num ecoponto. Um ecoponto pode ter zero ou um dispositivo activo de cada tipo. Um dispositivo pode ser movido entre ecopontos (histórico de instalações).
[[1.1 Schema PostgreSQL — iot_dispositivos]]

## 1.2 Schema PostgreSQL — `iot_dispositivos_historico`
Registo de todas as instalações e movimentações de um dispositivo entre ecopontos.
[[1.2 Schema PostgreSQL —  iot_dispositivos_historico]]

## 1.3 Schema PostgreSQL — `sensor_leituras` (especificação completa)
Versão completa da tabela esboçada anteriormente, agora com todos os campos e a estratégia de particionamento detalhada.
[[1.3 Schema PostgreSQL — sensor_leituras (especificação completa)]]

## 1.4 Schema PostgreSQL — `ecoponto_estado_atual` (especificação completa)
[[1.4 Schema PostgreSQL — ecoponto_estado_atual (especificação completa)]]
## 1.5 Schema PostgreSQL — `iot_alertas`
Registo de alertas gerados automaticamente pelo pipeline IoT — overflow, bateria fraca, offline prolongado.
[[1.5 Schema PostgreSQL — iot_alertas]]

## 1.6 Schema PostgreSQL — `iot_contactos_sms`
Lista de contactos para alertas SMS por zona (RF-27) — líderes locais e associações.
[[1.6 Schema PostgreSQL — iot_contactos_sms]]
# ENDPOINTS REST IoT
[[2.1 Gestão de Dispositivos]]
[[2.2 Ingestão de Telemetria]]
[[2.3 Alertas IoT]]
[[2.4 Contactos SMS (RF-27)]]
[[2.5 Dashboard Operacional (RF-05)]]
[[2.6 Zonas Prioritárias IoT (RF-26)]]

# PIPELINE COMPLETO IoT

## 3.1 Pipeline de ingestão — fluxo detalhado

```mermaid
sequenceDiagram
    autonumber
    participant S as Sensor físico
    participant GW as NestJS IoT Controller
    participant R as Redis
    participant W as Worker (iot.ingest)
    participant PG as PG Primário
    participant TC as Worker (threshold-check)
    participant N as notification.dispatch

    S->>GW: POST /iot/telemetria (X-Device-Key)
    GW->>GW: 1. auth HMAC-SHA256 vs api_key_hash
    alt key inválida / device != ATIVO
        GW-->>S: 401 / 403 (+ iot_alertas DEVICE_DESATIVADO)
    else válido
        GW->>GW: 2. valida ecoponto_id, timestamp, nível 0–100
        GW-->>S: 3. 202 Accepted (não espera processamento)
        GW->>W: 4. enfileira iot.ingest
        W->>W: a/b. normaliza nível + deteta anomalias (Δ>50% <5 min)
        W->>PG: c. INSERT sensor_leituras (partição)
        W->>PG: d. UPDATE iot_dispositivos (heartbeat, bateria, rssi)
        W->>PG: e/f. determina estado + UPSERT ecoponto_estado_atual
        PG-->>R: g. NOTIFY → DEL ecoponto + mapa:zona
        W->>TC: h. iot.threshold-check
        opt estado = CHEIO (sem alerta aberto)
            TC->>PG: INSERT iot_alertas (ECOPONTO_CHEIO)
            TC->>N: push Gestor + SMS contactos opt-in (RF-27)
        end
        opt bateria < limiar
            TC->>PG: INSERT iot_alertas (BATERIA_FRACA)
        end
    end
```

Detalhe textual completo do pipeline (todos os passos a/h):

```
SENSOR FÍSICO
  │
  ├── POST /iot/telemetria  com header X-Device-Key: {api_key}
  │
  └── NestJS IoT Controller
        │
        ├── 1. AUTENTICAÇÃO DO DISPOSITIVO
        │     HMAC-SHA256(api_key recebida, chave_secreta_app)
        │     → compara com iot_dispositivos.api_key_hash
        │     → se não coincidir: 401 Unauthorized
        │     → se coincidir mas estado != 'ATIVO': 403 Forbidden
        │                         + INSERT iot_alertas tipo 'DEVICE_DESATIVADO'
        │
        ├── 2. VALIDAÇÃO DO PAYLOAD
        │     a) ecoponto_id presente? (RF-04: rejeita se ausente)
        │     b) timestamp_leitura no passado? (rejeita se > now() + 30s)
        │     c) nivel_enchimento em 0-100?
        │     d) ecoponto_id corresponde ao dispositivo instalado?
        │     Se inválido: 400 + guarda com valida=false
        │
        ├── 3. RESPOSTA IMEDIATA AO SENSOR
        │     202 Accepted  ← sensor não espera pelo processamento
        │
        └── 4. BullMQ job: 'iot.ingest' (processamento assíncrono)
                │
                ├── a) CÁLCULO DO NÍVEL NORMALIZADO
                │       nivel_enchimento = nivel_raw_cm IS NOT NULL
                │         ? calcular_percentagem(nivel_raw_cm,
                │             dispositivo.config.altura_instalacao_cm,
                │             dispositivo.config.calibracao_offset)
                │         : payload.nivel_enchimento
                │
                ├── b) DETECÇÃO DE ANOMALIAS
                │       Delta anómalo: nivel actual vs anterior > 50%
                │         em < 5 min → marca valida=false
                │         → INSERT iot_alertas tipo 'LEITURA_ANOMALA'
                │
                ├── c) INSERT sensor_leituras (partição correcta)
                │       Inclui: nivel_raw_cm, nivel_enchimento calculado,
                │       estado_calculado, valida, motivo_invalida (se aplicável)
                │
                ├── d) UPDATE iot_dispositivos
                │       SET ultimo_heartbeat_em = now(),
                │           ultimo_nivel_battery_pct = payload.battery_pct,
                │           ultimo_signal_rssi = payload.signal_rssi
                │
                ├── e) DETERMINAR ESTADO DO ECOPONTO
                │       limiar_cheio ← zonas.alertas_config.limiar_cheio
                │         (default 85)
                │       estado = nivel_enchimento >= limiar_cheio
                │         ? 'CHEIO' : 'DISPONIVEL'
                │       Se valida=false: estado = 'AVARIADO'
                │
                ├── f) UPSERT ecoponto_estado_atual
                │       ON CONFLICT (ecoponto_id) DO UPDATE SET
                │         nivel_enchimento, estado, ultima_leitura_em,
                │         leitura_valida, battery_pct, signal_rssi,
                │         offline_desde = NULL (recuperou),
                │         atualizado_em = now()
                │
                ├── g) PostgreSQL TRIGGER AFTER UPDATE ON ecoponto_estado_atual
                │       → NOTIFY ecoponto_estado_updated,
                │           '{"ecoponto_id":"uuid","zona_id":"uuid",
                │             "estado":"CHEIO","nivel":92}'
                │         ┌── NestJS WS listener:
                │         │     DEL Redis ecoponto:{id}
                │         │     DEL Redis ecopontos:mapa:zona:{zona_id}
                │         │     emit WS room 'zona:{zona_id}' → dashboard ops
                │         └── BullMQ job: 'iot.threshold-check'
                │
                └── h) BullMQ job: 'iot.threshold-check'
                          │
                          ├── Se estado = 'CHEIO':
                          │     Existe alerta ECOPONTO_CHEIO aberto? (PG check)
                          │     SE NÃO: INSERT iot_alertas tipo 'ECOPONTO_CHEIO'
                          │             → BullMQ 'notification.dispatch'
                          │               → push ao gestor da zona
                          │               → SMS aos contactos opt-in (RF-27)
                          │
                          ├── Se battery_pct < limiar_battery (default 20):
                          │     INSERT iot_alertas tipo 'BATERIA_FRACA'
                          │     → push ao técnico
                          │
                          └── Se estado mudou de 'CHEIO' para 'DISPONIVEL':
                                Fecha alerta ECOPONTO_CHEIO aberto (resolvido_em)
                                INSERT iot_alertas tipo 'SENSOR_RECUPERADO' (INFO)
```

---

## 3.2 Job de detecção de offline — `iot.offline-detector`

```mermaid
flowchart TB
    CRON["BullMQ repeatable<br/>cada 5 min"] --> LOOP["Para cada dispositivo ATIVO"]
    LOOP --> CHK{"ultimo_heartbeat <<br/>now − timeout?"}
    CHK -->|não| OK["mantém estado"]
    CHK -->|sim| EST{"estado já<br/>OFFLINE?"}
    EST -->|sim| OK
    EST -->|não| UPD["UPDATE estado_atual = OFFLINE<br/>offline_desde = now()"]
    UPD --> AL["INSERT iot_alertas SENSOR_OFFLINE"]
    AL --> NT["NOTIFY → Redis DEL · WS update"]
    NT --> DISP["notification.dispatch<br/>push Gestor/técnico"]
    DISP --> ESC{"offline > 2× timeout?"}
    ESC -->|sim| SMS["SMS contactos opt-in (RF-27)"]
    ESC -->|não| OK

    classDef store fill:#1B5E20,color:#fff,stroke:#1B5E20;
    class UPD,AL store;
```

```
Execução: a cada 5 minutos (BullMQ repeatable job)

Para cada dispositivo WHERE estado = 'ATIVO':
  timeout_min ← dispositivo.config.timeout_offline_min (default 30)
  limite ← now() - interval(timeout_min minutes)

  IF ultimo_heartbeat_em < limite:
    IF ecoponto_estado_atual.estado != 'OFFLINE':
      ├── UPDATE ecoponto_estado_atual
      │     SET estado = 'OFFLINE',
      │         offline_desde = now()
      ├── INSERT iot_alertas tipo 'SENSOR_OFFLINE', severidade 'AVISO'
      ├── NOTIFY ecoponto_estado_updated (→ Redis invalidado, WS actualizado)
      └── BullMQ 'notification.dispatch'
            → push ao gestor e técnico
            → SMS contactos opt-in (RF-27) se offline > 2× timeout
```

---

## 3.3 Cache Redis — domínio IoT

```
┌──────────────────────────────────┬───────────┬──────────────────────────────┐
│ Chave                            │ TTL       │ Invalidação                  │
├──────────────────────────────────┼───────────┼──────────────────────────────┤
│ device:auth:{device_id}          │ 5 min     │ D10 (renovar api key)        │
│ (resultado da autenticação:      │           │ → DEL imediato               │
│  {dispositivo_id, ecoponto_id,   │           │                              │
│   estado, config})               │           │                              │
│ Cache crítica: evita PG read     │           │                              │
│ em cada uma das 10k msg/min      │           │                              │
├──────────────────────────────────┼───────────┼──────────────────────────────┤
│ device:heartbeat:{device_id}     │ timeout_  │ Renovado em cada T1/T3       │
│ (timestamp do último heartbeat   │ offline_  │ job offline-detector verifica│
│  — usado pelo offline-detector   │ min × 2   │ ausência desta chave         │
│  antes de ir ao PG)              │           │ como sinal de offline        │
├──────────────────────────────────┼───────────┼──────────────────────────────┤
│ iot:alertas:pendentes:zona:{id}  │ 1 min     │ NOTIFY iot_alerta_created    │
│ (contagem de alertas pendentes   │           │ → DEL                        │
│  por zona — badge do dashboard)  │           │                              │
├──────────────────────────────────┼───────────┼──────────────────────────────┤
│ iot:fila-prioridades:{zona_id}   │ 1 min     │ NOTIFY ecoponto_estado_      │
│ (array ordenado por score        │           │ updated → DEL                │
│  — endpoint OP3)                 │           │                              │
├──────────────────────────────────┼───────────┼──────────────────────────────┤
│ iot:dashboard:global             │ 2 min     │ NOTIFY ecoponto_estado_      │
│ (resumo: cheios, offline,        │           │ updated → DEL                │
│  alertas pendentes)              │           │                              │
├──────────────────────────────────┼───────────┼──────────────────────────────┤
│ iot:kpis:zona:{id}:{periodo}     │ 15 min    │ TTL natural                  │
│ (TMEF, MTTR, contagens RF-23)    │           │                              │
└──────────────────────────────────┴───────────┴──────────────────────────────┘
```

**Decisão crítica — `device:auth:{device_id}`:** Com 10.000 msg/min, ir ao PostgreSQL em cada ingestão para autenticar o dispositivo seria insustentável — significaria 10.000 queries/min só de autenticação. A cache Redis de autenticação do dispositivo (TTL 5 min) reduz este custo a praticamente zero. A invalidação em D10 (renovar API key) garante que um dispositivo comprometido não mantém acesso durante mais de 5 minutos após a rotação da key.

---

## 3.4 Relacionamentos completos — domínio IoT

```
iot_dispositivos (1)
  ├── (1) ecopontos               FK: iot_dispositivos.ecoponto_id (nullable)
  │                               um ecoponto tem no máximo 1 dispositivo activo
  │
  ├── (N) sensor_leituras         FK: sensor_leituras.dispositivo_id
  │                               (tabela particionada)
  │
  ├── (N) iot_alertas             FK: iot_alertas.dispositivo_id
  │
  └── (N) iot_dispositivos_       FK: historico.dispositivo_id
           historico              (audit trail de instalações)

ecopontos (1)
  ├── (1) ecoponto_estado_atual   FK: estado_atual.ecoponto_id
  │                               (1:1 denormalizado — hot path mapa)
  │
  ├── (N) iot_alertas             FK: iot_alertas.ecoponto_id
  │
  └── (N:1) zonas                 FK: ecopontos.zona_id

zonas (1)
  ├── (N) iot_alertas             FK: iot_alertas.zona_id
  │
  └── (N) iot_contactos_sms       FK: contactos_sms.zona_id (RF-27)
```

---

## 3.5 Separação de fluxos — resumo IoT

```
INGESTÃO (sensor → NestJS → BullMQ → PG → Redis)
─────────────────────────────────────────────────────────
T1 POST /iot/telemetria    → 202 imediato
                           → BullMQ iot.ingest
                             → INSERT sensor_leituras
                             → UPSERT ecoponto_estado_atual
                             → NOTIFY → Redis DEL ecoponto + zona
                             → BullMQ iot.threshold-check
                               → INSERT iot_alertas (se limiar)
                               → BullMQ notification.dispatch
T3 POST /iot/heartbeat     → Redis SET device:heartbeat TTL
                           → PG UPDATE ultimo_heartbeat_em (async)

LEITURA OPERACIONAL (FastAPI → Redis → PG réplica)
─────────────────────────────────────────────────────────
OP1 GET /dashboard         → Redis iot:dashboard:global (2min)
OP2 GET /heatmap           → Redis ecopontos:mapa:zona (2min)
OP3 GET /fila-prioridades  → Redis iot:fila-prioridades (1min)
OP4 GET /rota-sugestao     → PG réplica ST_Distance (sem cache
                             — dinâmico por posição do veículo)

GESTÃO (NestJS → PG primário)
─────────────────────────────────────────────────────────
D5  POST /dispositivos     → PG write (gera api_key, guarda hash)
D7  PATCH /instalar        → PG write transacção 5 operações
D9  PATCH /estado          → PG write + histórico
A3  PATCH /reconhecer      → PG write reconhecido_por
```