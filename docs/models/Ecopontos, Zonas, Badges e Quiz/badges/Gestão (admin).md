| #   | Método  | Rota                              | Descrição                                       | Auth  | Fluxo                                                 |
| --- | ------- | --------------------------------- | ----------------------------------------------- | ----- | ----------------------------------------------------- |
| B6  | `POST`  | `/badges`                         | Criar novo badge no catálogo                    | ADMIN | NestJS → PG write → NOTIFY → Redis invalidar catálogo |
| B7  | `PUT`   | `/badges/:id`                     | Actualizar badge (critérios, pontos, descrição) | ADMIN | NestJS → PG write → NOTIFY                            |
| B8  | `PATCH` | `/badges/:id/estado`              | Activar/desactivar badge                        | ADMIN | NestJS → PG write → NOTIFY                            |
| B9  | `POST`  | `/badges/:id/atribuir/:cidadaoId` | Atribuição manual de badge especial             | ADMIN | NestJS → PG write cidadao_badges → NOTIFY gamif       |

**Corpo de B6 (criar badge):**

```
{
  codigo: string (slug único, ex: "quiz_streak_5"),
  nome: string,
  descricao: string,
  icone_url: string (optional — MinIO path),
  categoria: "QUIZ" | "REPORTS" | "PARTICIPACAO" | "ESPECIAL" | "EDUCATIVO",
  criterio_tipo: "PRIMEIRO_REPORT" | "REPORTS_COUNT" | "QUIZ_STREAK"
               | "QUIZ_SCORE_PERFEITO" | "QUIZ_CATEGORIA_MESTRE"
               | "PARTICIPACAO_DIAS" | "ESPECIAL_MANUAL",
  criterio_valor: integer (optional — threshold numérico),
  criterio_config: object (optional — critérios compostos),
  pontos_recompensa: integer,
  secreto: boolean (default false)
}
```

**Nota sobre B5 (progresso):** Este endpoint é computacionalmente pesado — para cada badge não ganho, calcula o estado actual do cidadão face ao critério. Deve ser restrito a cidadãos com gamificação activa (opt-in), limitado a 20 badges por chamada, e com cache Redis de 5 minutos por cidadão: `cidadao:badges:progresso:{user_id}`.