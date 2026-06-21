# Quiz — Gestão (gestor/admin)

> ⚙️ **Estado da implementação.** O que está **implementado** hoje é a **gestão
> de perguntas sobre o pool ativo único** ("Banco de Perguntas EcoBairro"), não o
> CRUD de quizzes por evento. A spec original (Q10–Q16, ADMIN-only, quiz por
> evento) mantém-se como desenho futuro. Diferenças face à spec:
>
> - **Acesso: `GESTOR` + `ADMIN`** (não só ADMIN) — `assertManager` no service.
> - **Modelo "pool único"**: o backend sorteia N perguntas do pool ativo por
>   sessão (não há quiz fixo por evento), por isso a gestão é ao nível de
>   **pergunta**, não de quiz.
> - **Histórico não bloqueia edição**: `quiz_sessoes.respostas` faz snapshot de
>   `opcaoId`/pontos (JSON), por isso editar/apagar perguntas não corrompe
>   sessões antigas — a restrição `count=0` da spec não se aplica.
> - Código: `apps/api/src/gamification/quiz-admin.controller.ts` +
>   `quiz-admin.service.ts`; UI `apps/web/src/routes/_layoutmain.gestao-quiz.tsx`.

## Endpoints implementados (perguntas do pool ativo)

| Método   | Rota                              | Descrição                                  | Auth         |
| -------- | --------------------------------- | ------------------------------------------ | ------------ |
| `GET`    | `/api/v1/admin/quiz/perguntas`    | Listar perguntas do pool (inclui `correta`) | GESTOR/ADMIN |
| `POST`   | `/api/v1/admin/quiz/perguntas`    | Criar pergunta + opções (2-6, 1 correta)   | GESTOR/ADMIN |
| `PATCH`  | `/api/v1/admin/quiz/perguntas/:id`| Editar; `opcoes` substitui todas           | GESTOR/ADMIN |
| `DELETE` | `/api/v1/admin/quiz/perguntas/:id`| Apagar pergunta (cascade nas opções)       | GESTOR/ADMIN |

## Spec original (desenho futuro — quiz por evento, ADMIN)

| #   | Método   | Rota                                  | Descrição                                             | Auth  | Fluxo                                                              |
| --- | -------- | ------------------------------------- | ----------------------------------------------------- | ----- | ------------------------------------------------------------------ |
| Q10 | `GET`    | `/admin/quiz`                         | Listar todos os quizzes (activos, futuros, passados)  | ADMIN | NestJS → PG réplica                                                |
| Q11 | `POST`   | `/admin/quiz`                         | Criar quiz com perguntas e opções                     | ADMIN | NestJS → PG write (transacção: quiz + perguntas + opcoes) → NOTIFY |
| Q12 | `PUT`    | `/admin/quiz/:id`                     | Actualizar quiz (só se nenhum cidadão o jogou ainda)  | ADMIN | NestJS → verifica quiz_sessoes count=0 → PG write                  |
| Q13 | `DELETE` | `/admin/quiz/:id`                     | Cancelar quiz (soft: ativo=false, só se não iniciado) | ADMIN | NestJS → PG write ativo=false → NOTIFY                             |
| Q14 | `POST`   | `/admin/quiz/:id/pergunta`            | Adicionar pergunta a quiz existente                   | ADMIN | NestJS → valida ordem e limite → PG write                          |
| Q15 | `PUT`    | `/admin/quiz/:id/pergunta/:pId`       | Editar pergunta (só se quiz não iniciado)             | ADMIN | NestJS → verifica disponivel_de > now() → PG write                 |
| Q16 | `POST`   | `/admin/quiz/:id/pergunta/:pId/opcao` | Adicionar opção a uma pergunta                        | ADMIN | NestJS → valida max 5 opções → PG write                            |
**Nota sobre Q12 (actualizar quiz):** A restrição `quiz_sessoes count = 0` é fundamental. Uma vez que um cidadão jogou o quiz, o schema de perguntas e opções torna-se imutável — alterar perguntas após sessões já registadas invalidaria os resultados históricos. O admin deve criar um novo quiz em vez de editar