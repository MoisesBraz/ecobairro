| #   | Método | Rota                     | Descrição                                         | Auth     | Fluxo                                         |
| --- | ------ | ------------------------ | ------------------------------------------------- | -------- | --------------------------------------------- |
| B1  | `GET`  | `/badges`                | Listar catálogo completo de badges activos        | CIDADAO+ | NestJS → Redis `badges:catalogo` TTL 2h ou PG |
| B2  | `GET`  | `/badges/:id`            | Detalhe de um badge (critério, pontos, descrição) | CIDADAO+ | NestJS → Redis ou PG réplica                  |
| B3  | `GET`  | `/badges/categoria/:cat` | Listar por categoria                              | CIDADAO+ | NestJS → Redis `badges:categoria:{cat}` ou PG |
