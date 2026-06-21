> Parte de [[Init]]. Consulta de zonas — **derivadas por proximidade**.

# Zonas — consulta

> **Mudança de arquitetura.** A zona é uma **etiqueta de texto derivada
> automaticamente** (clustering de proximidade a 50 m), não uma entidade gerida.
> **Não existem endpoints `/zonas/*`** próprios. A zona consulta-se através do
> ecoponto. Ver [[1.2 Schema PostgreSQL — zonas]].

## Como consultar

| Objetivo | Como | Auth |
| --- | --- | --- |
| Ver a zona de um ecoponto | `GET /ecopontos` / `GET /ecopontos/:id` → campo `zona` | CIDADAO+ |
| Filtrar ecopontos por zona | `GET /ecopontos?zona=<valor>` (match exato, case-insensitive) | CIDADAO+ |
| Listar zonas existentes | derivar do conjunto: valores distintos de `zona` em `GET /ecopontos` | CIDADAO+ |
| Agrupar/contar por zona | endpoint de analytics (`GROUP BY zona`) | OPERADOR+ |

A página `/zonas` do frontend (operador/gestor/admin) é **só de leitura**: agrupa os
ecopontos pela zona derivada e mostra contagens/KPIs. Não tem criação nem edição.

## Endpoints removidos (design anterior, nunca implementado)

Os endpoints Z1–Z5 (`GET /zonas`, `/zonas/:id`, `/zonas/:id/ecopontos`,
`/zonas/minha`, `/zonas/ponto`) **não existem**. Dependiam de geometria
`MULTIPOLYGON` e de `ST_Within`, abolidos com a passagem ao modelo derivado por
proximidade.

- `Z3 GET /zonas/:id/ecopontos` → usar `GET /ecopontos?zona=<valor>`.
- `Z5 GET /zonas/ponto?lat=&lng=` → o agrupamento por proximidade é feito pelo
  backend ao criar/mover o ecoponto; não há lookup de polígono por ponto.
