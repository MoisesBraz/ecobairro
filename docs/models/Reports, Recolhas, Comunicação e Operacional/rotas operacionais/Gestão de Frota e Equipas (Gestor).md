# Endpoints REST — Gestão de Frota e Equipas (Gestor) (RF-28, RF-29)

Endpoints usados pelo **Gestor/Admin** para gerir a frota de [[7.2 Schema PostgreSQL — carrinhas|carrinhas]] e montar [[7.3 Schema PostgreSQL — equipas_rota|equipas de rota]]. A execução em terreno está em [[Execução de Rota (Operador)]].

## Frota (carrinhas) — RF-28

| # | Método | Rota | Descrição | Auth | Fluxo |
|---|--------|------|-----------|------|-------|
| FR1 | `GET` | `/carrinhas` | Listar frota (filtros: estado, zona) | GESTOR, ADMIN | NestJS → PG réplica |
| FR2 | `GET` | `/carrinhas/:id` | Detalhe de uma carrinha | GESTOR, ADMIN | NestJS → Redis ou PG |
| FR3 | `POST` | `/carrinhas` | Registar veículo | GESTOR, ADMIN | NestJS → PG write → audit_log |
| FR4 | `PUT` | `/carrinhas/:id` | Atualizar dados (tipo, capacidade, zona-base) | GESTOR, ADMIN | NestJS → PG write → NOTIFY |
| FR5 | `PATCH` | `/carrinhas/:id/estado` | Mudar estado (ex.: → MANUTENCAO) | GESTOR, ADMIN | NestJS → PG write → audit_log |
| FR6 | `DELETE` | `/carrinhas/:id` | Soft delete (só se não estiver em equipa ativa) | ADMIN | NestJS → verifica dependências → PG `eliminado_em` |

**Corpo de FR3 (registar carrinha):**

```
{
  matricula: string (required, único),
  tipo: "LIGEIRA" | "PESADA" | "SATELITE",
  capacidade_kg: integer (> 0),
  zona_base_id: uuid (optional),
  notas: string (optional)
}
```

## Equipas de rota — RF-29

| # | Método | Rota | Descrição | Auth | Fluxo |
|---|--------|------|-----------|------|-------|
| EQ1 | `GET` | `/equipas` | Listar equipas (filtros: zona, estado) | GESTOR, ADMIN | NestJS → PG réplica |
| EQ2 | `POST` | `/equipas` | Criar equipa (operadores + carrinha + zona + ecopontos) | GESTOR, ADMIN | valida disponibilidade → PG write → carrinha `EM_ROTA` → BullMQ notif operadores |
| EQ3 | `PUT` | `/equipas/:id` | Reatribuir operadores/carrinha | GESTOR, ADMIN | NestJS → PG write → NOTIFY |
| EQ4 | `PATCH` | `/equipas/:id/cancelar` | Cancelar equipa | GESTOR, ADMIN | PG write `CANCELADA` → carrinha `DISPONIVEL` → audit_log |

**Corpo de EQ2 (criar equipa):**

```
{
  carrinha_id: uuid (required, deve estar DISPONIVEL),
  operadores: uuid[] (required, >=1, todos disponivel=true),
  zona_id: uuid (required),
  ecopontos_planeados: uuid[] (required, da sugestão de rotas RF-05),
  turno: "MANHA" | "TARDE" (optional)
}
```

**Validações (serviço):**
- Carrinha em `DISPONIVEL` e operadores com `operador_perfis.disponivel = true` (senão `409 Conflict`).
- Ao criar: carrinha → `EM_ROTA`; cada operador notificado (push/email, BullMQ).
- Toda a operação é registada em `audit_log` (RNF-SEG-03).

## Estado de implementação (atual)

A **sugestão de rotas RF-05 já está implementada** (OP4 — ver
[[models/IoT e Dispositivos/IoT/2.5 Dashboard Operacional (RF-05)|Dashboard Operacional]]):
o gestor gera uma rota real (OSRM `/trip` + fallback greedy) no serviço analytics e grava-a
via `POST /v1/rotas`. As **paragens** ficam, por agora, na tabela `rotas` (campos JSON
`geometria`/`paragens`/`zona`) — **não** há ainda `rotas_execucao` nem `equipas_rota` como
tabelas relacionais; a atribuição a operador/equipa faz-se via `PATCH /v1/rotas/:id` e o
módulo de equipas existente. A integridade relacional (join table `RotaEcoponto`,
`ecopontos_planeados` vs `ecopontos_visitados`) continua trabalho futuro.

## Ver também

- [[Execução de Rota (Operador)]] — o que o operador faz a seguir
- [[7.2 Schema PostgreSQL — carrinhas]] · [[7.3 Schema PostgreSQL — equipas_rota]]
- [[02-Requisitos/M11-Frota-Equipas]]
