> Parte de [[Init]]. Gestão de zonas — **abolida** (zona é derivada).

# Zonas — gestão

> **Mudança de arquitetura.** A gestão manual de zonas foi **abolida**. A zona é
> derivada automaticamente pelo backend (clustering de proximidade a 50 m), pelo que
> **não há criação, edição nem remoção** de zonas por gestores/admins.
> Ver [[1.2 Schema PostgreSQL — zonas]].

## Endpoints removidos (design anterior, nunca implementado)

Os endpoints Z6–Z14 deixaram de existir:

| # | Antigo endpoint | Estado |
| --- | --- | --- |
| Z6 | `POST /zonas` (criar zona com GeoJSON `MULTIPOLYGON`) | **removido** — zona deriva da localização |
| Z7 | `PUT /zonas/:id` (atualizar dados/config) | **removido** |
| Z8 | `PATCH /zonas/:id/geometria` | **removido** — não há geometria |
| Z9 | `DELETE /zonas/:id` | **removido** |
| Z10 | `PUT /zonas/:id/alertas` (anti-spam por zona) | **removido** |
| Z11–Z14 | KPIs / zonas prioritárias IoT / cobertura sensores | **fora de âmbito** neste modelo |

## Como a zona é atribuída agora

A atribuição é uma consequência automática da gestão de **ecopontos**
(ver [[Gestão do catálogo]]):

- `POST /ecopontos` — ao criar, o backend deriva a zona: herda a do ecoponto
  vizinho mais próximo a ≤ 50 m; se isolado, cria zona nova com o nome da morada.
  O campo `zona` **não** é aceite no corpo do pedido.
- `PATCH /ecopontos/:id` — se a localização (`lat`/`lng`) mudar, a zona é
  **recalculada**; caso contrário mantém-se. O `zona` enviado pelo cliente é ignorado.

Lógica em `apps/api/src/ecopontos/zona.helper.ts`
(`resolveZona`, `haversineMetros`, `ZONA_RAIO_METROS = 50`).
