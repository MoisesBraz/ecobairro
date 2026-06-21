| #   | Método | Rota                            | Descrição                                      | Auth             | Fluxo                                   |
| --- | ------ | ------------------------------- | ---------------------------------------------- | ---------------- | --------------------------------------- |
| B4  | `GET`  | `/cidadaos/me/badges`           | Badges ganhos pelo cidadão autenticado (RF-20) | CIDADAO          | NestJS → PG réplica join badges         |
| B5  | `GET`  | `/cidadaos/me/badges/progresso` | Progresso nos badges ainda não ganhos          | CIDADAO (opt-in) | NestJS → PG réplica + lógica de cálculo |
