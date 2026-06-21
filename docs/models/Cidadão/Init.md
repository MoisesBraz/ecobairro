## EcoBairro Digital - Design Document

> Parte de [[Home]] · [[07-Modelo-de-Dados]]. Domínio de identidade, perfis e autenticação.
> Requisitos: [[02-Requisitos/M09-Utilizadores-Perfis|Módulo 9 — Utilizadores e Perfis]] (RF-24/RF-25).

### Mapeamento de Endpoints REST
### Convenções gerais

```
Base URL NestJS:  /api/v1
Base URL FastAPI: /analytics/v1

Autenticação:
  Bearer JWT em Authorization header
  Roles: CIDADAO | OPERADOR | GESTOR | ADMIN

Fluxo padrão:
  Escrita  → NestJS → PostgreSQL (primário) → NOTIFY → Redis invalidado
  Leitura  → NestJS → Redis (cache hit) | PostgreSQL réplica (miss)
  Analytics→ FastAPI → Redis (cache hit) | PostgreSQL réplica (miss)
```

[[1.1 Autenticação e gestão de conta]]
[[1.2 Perfil do Cidadão (CRUD)]]
[[1.3 RGPD e Consentimentos]]
[[1.4 Preferências de Notificações]]
[[1.5 Ecopontos Favoritos]]
[[1.6 Reports (perspectiva do Cidadão)]]
[[1.7 Pedidos de Recolha de Monos]]
[[1.8 Gamificação (RF-18, RF-19, RF-20)]]
[[1.9 Perfil do Gestor]]
[[1.10 Perfil do Operador (terreno)]]

###  2 — Esquema de Base de Dados

#### Arquitectura de 3 camadas para identidade e perfis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Camada 1 — Identidade e autenticação (partilhada por todos)                │
│   tabela: users                                                             │
│   Contém: email, password_hash, role, 2FA, estado da conta                 │
│   Usado por: qualquer utilizador do sistema                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Camada 2A — Perfil do cidadão (extensão de users)                          │
│   tabela: cidadao_perfis                                                    │
│   Contém: dados pessoais, preferências, RGPD, gamificação opt-in           │
│   Relação: 1:1 com users WHERE role = 'CIDADAO'                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Camada 2B — Perfil do gestor (extensão de users)                           │
│   tabela: gestor_perfis                                                     │
│   Contém: entidade empregadora, zona(s) de responsabilidade, cargo         │
│   Relação: 1:1 com users WHERE role IN ('GESTOR','ADMIN')                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Camada 2C — Perfil do operador de terreno (extensão de users)              │
│   tabela: operador_perfis                                                   │
│   Contém: carta de condução, zona-base, disponibilidade                    │
│   Relação: 1:1 com users WHERE role = 'OPERADOR'                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Tabela `users` — Camada 1

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  tabela: users                                                              │
├──────────────────────────┬──────────────────────┬───────────────────────────┤
│ coluna                   │ tipo                 │ constraints / notas       │
├──────────────────────────┼──────────────────────┼───────────────────────────┤
│ id                       │ UUID                 │ PK, gen_random_uuid()     │
│ email                    │ VARCHAR              │ NOT NULL, UNIQUE          │
│ password_hash            │ VARCHAR              │ NOT NULL (bcrypt)         │
│ phone                    │ VARCHAR              │ nullable                  │
│ email_verified           │ BOOLEAN              │ NOT NULL, DEFAULT false   │
│ email_verified_at        │ TIMESTAMPTZ          │ nullable                  │
│ role                     │ VARCHAR(50)          │ NOT NULL                  │
│                          │                      │ CHECK IN (                │
│                          │                      │  'CIDADAO',               │
│                          │                      │  'OPERADOR',              │
│                          │                      │  'GESTOR',                │
│                          │                      │  'ADMIN')                 │
│ 2fa_enabled              │ BOOLEAN              │ NOT NULL, DEFAULT false   │
│ 2fa_secret               │ VARCHAR              │ nullable, cifrado repouso │
│ criado_em                │ TIMESTAMPTZ          │ NOT NULL, DEFAULT now()   │
│ atualizado_em            │ TIMESTAMPTZ          │ NOT NULL, DEFAULT now()   │
│ eliminado_em             │ TIMESTAMPTZ          │ nullable (soft delete)    │
└──────────────────────────┴──────────────────────┴───────────────────────────┘

Índices:
  (email)          UNIQUE BTREE — login lookup
  (eliminado_em)   PARTIAL BTREE WHERE NOT NULL — archiving queries
```

Notas de design críticas:
	A tabela `users` contém APENAS dados de identidade e autenticação. Dados de perfil, PII e preferências vivem nas tabelas de extensão (`cidadao_perfis`, `gestor_perfis`).
	nif_cifrado e morada_cifrada (em `cidadao_perfis`) guardam o valor cifrado em AES-256 pela camada de aplicação antes de escrever no PostgreSQL. O banco de dados nunca vê o valor em claro, isto garante que mesmo um dump do PostgreSQL não expõe PII, alinhado com RNF-PRIV-01. A busca por NIF (admin) passa pela camada app que calcula HMAC-SHA256(nif, chave_secreta_app) e compara com o hash indexado na coluna `cidadao_perfis.nif_hash`.
	eliminado_em (em `users`) implementa soft delete. Um job BullMQ agendado pela eliminação anonimiza os registos em `users` e `cidadao_perfis` (apaga nome, email → anonimizado_{id}@ecobairro.deleted, hash, PII) mantendo o UUID para referências de integridade em reports históricos.

[[2.9 Schema PostgreSQL — cidadao_perfis]]
[[2.10 Schema PostgreSQL — gestor_perfis]]
[[2.11 Schema PostgreSQL — operador_perfis]]
[[2.7 Índices estratégicos]]
[[2.8 Mapa de relacionamentos]]

### 3 — Estratégia de Persistência e Cache

#### 3.1 PostgreSQL — fonte de verdade

```
┌─────────────────────────────┬──────────────────────────────────────────────┐
│ Dado / Operação             │ Justificação para PostgreSQL                 │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ Identidade e autenticação   │ Consistência ACID obrigatória; password_hash  │
│                             │ nunca cacheado; 2FA secret cifrado em repouso │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ Consentimentos RGPD         │ Append-only audit trail; nunca cache — leitura│
│                             │ crítica para conformidade legal               │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ NIF / morada (sensíveis)    │ Cifrado em repouso; acesso raro e auditado;   │
│                             │ proibido em cache (RNF-PRIV-01/04)           │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ Quiz sessoes e scores       │ Histórico permanente; 24 meses retenção;      │
│                             │ JSONB adequado para respostas variáveis       │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ Localização (geography)     │ PostGIS queries de proximidade, ST_Distance;  │
│                             │ joins geoespaciais com ecopontos/zonas        │
├─────────────────────────────┼──────────────────────────────────────────────┤
│ Logs e audit trail          │ RNF-SEG-03: retenção ≥24 meses; imutáveis    │
└─────────────────────────────┴──────────────────────────────────────────────┘
```
[[3.2 Redis — cache e operações rápidas]]

O motivo de não utilizar o NoSQL para este tipo de desenvolvimento: 
**Caso 1 - Full-text search em nomes/moradas de Cidadão**
A extensão do PostgreSQL `'pg_trgm'` com índice GIN sobre o `nome_completo` suporta buscas `ILIKE '%nome%'` em milissegundos para volumes municipais. O a utilização de uma base de dados tipo MongoDB só seria justificável se fossem milhões de documentos com buscas complexas de relevância.

**Caso 2 — Pesquisa de reports por zona**

```
Padrão de acesso:
  - Cidadão: "os meus reports" → filtra por cidadao_id (PK scan)
  - Gestor: "reports desta zona" → filtra por zona_id + estado
  - FastAPI: "heatmap de reports" → agregação por zona + data

Solução PostgreSQL:
  reports (zona_id, estado, criado_em) → índice BTREE composto
  + Redis cache dos resultados (TTL 5min para gestor)
  + PostGIS para queries de proximidade quando zona é radius

Volume: 10.000 msg/min de telemetria IoT NÃO é reports de cidadãos.
Reports estimados: 100-500/dia para uma cidade como Aveiro.
Com 24 meses de retenção = ~180.000 reports máximo.
PostgreSQL gere este volume trivialmente.
```
Neste caso não existe motivos para o uso do Mongo nos reports. O PostgreSQL com JSONB com índices GIN resolve queries sobre campos dinâmicos.

### 4 — Considerações de Performance
#### 4.1 Gargalos identificados e mitigações

**Gargalo 1 — Login com 2FA: duas viagens ao Redis + uma ao PG**

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilizador
    participant N as NestJS
    participant PG as PG (users)
    participant R as Redis

    U->>N: POST /auth/login (email, password)
    N->>PG: verify password_hash (bcrypt)
    alt 2FA ativo
        N->>R: SET pre_auth:{user} (TTL curto)
        N-->>U: desafio 2FA
        U->>N: POST /auth/2fa/verify (código)
        N->>R: GET pre_auth + DEL
        N-->>U: JWT (role)
    else sem 2FA
        N-->>U: JWT (role)
    end
```

```
Fluxo normal:   POST /auth/login → PG (password verify) → Redis (set pre_auth)
                POST /auth/2fa/verify → Redis (get pre_auth) → Redis (del) → JWT

Mitigação: connection pooling PgBouncer em modo transaction;
           Redis pipeline para operações múltiplas na mesma chamada.
```

**Gargalo 2 — Verificação anti-spam por zona (RF-09) em cada report**

Esta operação precisa de ser O(1) e não pode ir ao PostgreSQL (seria uma leitura + escrita sincronamente no path de criação de report). Redis `INCR` + `EXPIREAT` resolve em <1ms.

```
Algoritmo anti-spam:
  1. GET antispam:report:{user_id}:{zona_id}
  2. SE valor >= 2 → rejeita (403)
  3. INCR antispam:report:{user_id}:{zona_id}
  4. SE valor era 0 (nova chave): EXPIREAT → agora + 86400s
  5. Continua criação do report no PG
```

**Gargalo 3 — Queries de proximidade com localizacao_ultima (GIST)**

`ST_DWithin(localizacao_ultima, ponto_ref, raio)` com índice GIST sobre `localizacao_ultima` tem performance excelente até centenas de milhares de registos. O índice GIST em `geography` usa a árvore R-tree internamente. Para o EcoBairro, esta query só é executada por admin (listar cidadãos numa zona) — não é um hot path.

**Gargalo 4 — Leitura de widgets do dashboard (RF-22)**

Cada carregamento de dashboard lê `dashboard_widgets` (JSONB) + estado actual dos ecopontos favoritos + notificações recentes. São 3 queries.

```
Estratégia: Redis cache composto
  cidadao:dashboard:{user_id} → {widgets, favoritos_ids}  TTL: 30min
  Estado dos ecopontos favoritos → consultado separadamente
  (invalidado por NOTIFY ecoponto_updated, não por evento do cidadão)
```

#### 4.2 Archiving e retenção (RNF-DADOS-01)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Estratégia de archiving — 24 meses                                         │
├────────────────────────────┬──────────────────────────────────────────────  │
│ Tabela                     │ Estratégia                                    │
├────────────────────────────┼────────────────────────────────────────────── │
│ reports                    │ Particionamento por RANGE(criado_em) por mês   │
│                            │ Após 24 meses: anonymize + move para partição  │
│                            │ cold (tablespace lento). Report em si persiste │
│                            │ mas cidadao_id → NULL, foto apagada do MinIO   │
├────────────────────────────┼────────────────────────────────────────────── │
│ quiz_sessoes               │ Não contém PII. Retenção indefinida para KPIs  │
│                            │ históricos. Não requer archiving obrigatório   │
├────────────────────────────┼────────────────────────────────────────────── │
│ cidadao_consentimentos     │ Retenção permanente (audit legal RGPD)         │
│                            │ Nunca apagar — apenas anonimizar o cidadao_id  │
│                            │ quando cidadão elimina conta                   │
├────────────────────────────┼────────────────────────────────────────────── │
│ notificacoes (histórico)   │ Partição por mês, drop partições >24 meses    │
│                            │ via job BullMQ semanal                         │
└────────────────────────────┴────────────────────────────────────────────── │
```

---

### 4.3 Separação de fluxos — resumo executivo

```
ESCRITA (NestJS → PG primário → Redis invalidado)
──────────────────────────────────────────────────
POST /auth/register          → PG write users + cidadao_perfis
POST /auth/login             → PG read users (verify hash) → Redis set session
PUT  /cidadaos/me            → PG write cidadao_perfis → NOTIFY → Redis DEL
PUT  /gestores/me          → PG write gestor_perfis → NOTIFY → Redis DEL
POST /cidadaos/me/consent.   → PG write append-only
POST /reports                → Redis INCR antispam → PG write → BullMQ
PUT  /gamificacao/quiz/resp. → PG write quiz_sessoes → Redis DEL gamif

LEITURA (NestJS → Redis hit | PG réplica miss)
──────────────────────────────────────────────────
GET /cidadaos/me             → Redis:cidadao:profile ou PG réplica (join users+cidadao_perfis)
GET /gestores/me           → Redis:gestor:profile ou PG réplica (join users+gestor_perfis)
GET /cidadaos/me/favoritos   → Redis:favoritos (ids) + PG réplica (estado)
GET /cidadaos/me/notif/pref  → Redis:notif_prefs ou PG réplica
Verificação RBAC por pedido  → Redis:user:rbac (TTL 5min) ou PG

ANALYTICS (FastAPI → Redis hit | PG réplica miss)
──────────────────────────────────────────────────
GET /gamificacao/ranking/:zona → Redis cache TTL 10min ou PG agregação
GET /analytics/... (dashboards) → Redis TTL 5-30min conforme endpoint

PII — NUNCA CACHE
──────────────────────────────────────────────────
GET /cidadaos/me/dados-sensiveis → SEMPRE PG primário (cidadao_perfis), NUNCA Redis
GET /admin/cidadaos             → SEMPRE PG réplica (join users+cidadao_perfis), NUNCA Redis
GET /cidadaos/me/consentimentos → SEMPRE PG réplica, NUNCA Redis
```

---

### 4.4 Checklist de implementação para performance <2s (RNF-PERF-02)

```
☐ PgBouncer em modo transaction entre NestJS e PG (elimina overhead de conn.)
☐ Índice GIN em notificacao_prefs JSONB (se queries por campo de preferência)
☐ Índice GIN em dashboard_widgets JSONB (se queries por widget específico)
☐ pg_trgm activado + índice GIN trgm em cidadao_perfis.nome_completo e gestor_perfis.nome_completo
☐ GIST em cidadao_perfis.localizacao_ultima (geography)
☐ Partial index em users WHERE eliminado_em IS NULL (todas as queries normais)
☐ Redis connection pool no NestJS (ioredis com pool size ≥ 10)
☐ NOTIFY triggers separados em users, cidadao_perfis e gestor_perfis (não em audit_updated_at)
☐ BullMQ workers separados do processo NestJS principal (Swarm service dedicado)
☐ Job de anonimização (eliminado_em) processado async no BullMQ — nunca no req/resp
```

Continuação das rotas e arquitetura [[Ecopontos, Zonas, Badges e Quiz/Init|Init]] · voltar a [[Home]]
