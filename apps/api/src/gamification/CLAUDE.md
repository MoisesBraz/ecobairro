# GAMIFICATION module (`/api/v1/gamification`)

Quiz jogável sobre lixo/reciclagem + resumo de gamificação (pontos, nível,
ranking, conquistas). Cobre RF-18 (opt-in), RF-19 (quiz semanal) e RF-20
(recompensas educativas) — ver `docs/02-Requisitos/M06-Gamificacao.md`.

## Estrutura do diretório

```text
gamification/
  gamification.module.ts
  gamification.controller.ts
  gamification.service.ts
  quiz-admin.controller.ts   # @Controller('admin/quiz') — gestão (GESTOR/ADMIN)
  quiz-admin.service.ts      # CRUD de perguntas + assertManager
  quiz-random.util.ts        # sorteio Fisher-Yates (RNG injetável)
  dto/
    submit-quiz.dto.ts
    list-history.dto.ts
    create-quiz-question.dto.ts
    update-quiz-question.dto.ts
```

## Endpoints

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST   | `/gamification/optin` | Ativa a gamificação (RF-18) | CIDADAO |
| DELETE | `/gamification/optin` | Desativa (mantém histórico) | CIDADAO |
| GET    | `/gamification/quiz/me` | Resumo: hero, stats, ranking, conquistas, `optedIn` | CIDADAO |
| POST   | `/gamification/quiz/iniciar` | Sorteia N perguntas, cria sessão Redis | CIDADAO + opt-in |
| POST   | `/gamification/quiz/sessao/:sessaoId/responder` | Submete respostas, pontua, feedback | CIDADAO + opt-in |
| GET    | `/gamification/quiz/historico` | Sessões concluídas (paginado) | CIDADAO |

### Gestão de perguntas (`admin/quiz`, `quiz-admin.controller.ts`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET    | `/admin/quiz/perguntas` | Lista perguntas do pool ativo (**inclui `correta`**) | GESTOR/ADMIN |
| POST   | `/admin/quiz/perguntas` | Cria pergunta + opções no pool ativo | GESTOR/ADMIN |
| PATCH  | `/admin/quiz/perguntas/:id` | Atualiza pergunta; `opcoes` (se enviada) substitui todas | GESTOR/ADMIN |
| DELETE | `/admin/quiz/perguntas/:id` | Apaga pergunta (cascade apaga opções) | GESTOR/ADMIN |

- Acesso ao nível do service (`assertManager` = `GESTOR` ou `ADMIN`); o
  `JwtAuthGuard` só valida o token. Auditoria best-effort (`AuditService`).
- **Esta é vista de gestão** → expõe `correta` (ao contrário do jogo do cidadão).
- Opera sobre o **pool ativo único** (`Quiz.ativo=true`). Sem pool → `QUIZ_UNAVAILABLE`.
- `ordem` da nova pergunta = `max(ordem do pool)+1`; opções pela ordem do array.
- Edição substitui opções (delete+create em transação) — **não corrompe o
  histórico** porque `QuizSessao.respostas` faz snapshot de `opcaoId`/`pontos`.

## Modelo de dados (Prisma)

- `Quiz` (`quizzes`) — **pool** de perguntas. O seed cria um pool ativo "Banco
  de Perguntas EcoBairro"; `numeroPerguntas` define quantas sortear por sessão.
- `QuizPergunta` (`quiz_perguntas`) — pergunta + `explicacaoEducativa` (feedback
  obrigatório) + `categoria` (`ORGANICOS`/`RECICLAGEM`/`LEGISLACAO`/`GERAL`).
- `QuizOpcao` (`quiz_opcoes`) — exatamente **1** com `correta=true` por pergunta
  (índice parcial `quiz_opcoes_correta_idx`).
- `QuizSessao` (`quiz_sessoes`) — sessão concluída: `respostas` (JSON), `scoreObtido`.
- `QuizDesafio` (`quiz_desafios`) — só metadados do hero ("Desafio da Semana").
- `CidadaoPerfil.gamificationOptIn` — flag de adesão.

Banco curado das perguntas: `apps/api/prisma/quiz-bank.ts` (PT-PT).

## Invariantes (NÃO QUEBRAR)

- **Perguntas aleatórias** = sorteio do pool por sessão (Fisher-Yates,
  `quiz-random.util.ts`), **não** geração por LLM em runtime. RNG injetável no
  3.º arg do construtor do service (`@Optional()`) → determinismo nos testes.
- **`correta` nunca sai para o cliente** em `iniciar` (`QuizQuestionPublic` só
  tem `id/ordem/texto`). A opção correta é lida da BD apenas em `responder`.
- **Sessão em Redis** `quiz:sessao:{id}` com **TTL 1800s** (30 min, RF-19);
  apagada após `responder`. `responder` valida o dono da sessão.
- **Opt-in estrito** — `iniciar`/`responder` exigem `gamificationOptIn=true`
  (senão `QUIZ_OPT_IN_REQUIRED` → 403).
- **Feedback educativo sempre** — `explicacaoEducativa` devolvida por pergunta
  no resultado, certa ou errada.
- **Pontuação** integra-se na gamificação: `pontos = reports*100 + partilhas*50
  + Σ scoreObtido` (pontos por pergunta = `QuizPergunta.pontos`, default 10).
- **Exatamente 1 opção correta** + **2-6 opções** por pergunta — validado no
  `quiz-admin.service.ts` (`validateOpcoes`), não só no DTO.
- **Seed *create-if-absent*** — `seed.ts` só recria o pool se este não tiver
  perguntas; assim re-correr o seed **não apaga** perguntas adicionadas pelo
  gestor em runtime.

## O que falta realizar (futuro, fora do âmbito atual)

- Tabela `badges`/`cidadao_badges` + atribuição assíncrona (BullMQ) + WebSocket.
- Ranking **anónimo por zona** (atualmente o ranking mostra nomes; RNF-PRIV-04).
- Estatísticas por pergunta (taxa de acerto) e CRUD de **pools/quizzes** por
  evento (hoje a gestão é só de **perguntas** sobre o pool ativo único).
- Cache Redis do quiz atual e dos rankings; imagens (MinIO).

## O que não fazer

- Não enviar `correta` em `iniciar`/`GET` de perguntas **do cidadão** (a vista de
  gestão `admin/quiz` expõe-no de propósito — não a confundir com o jogo).
- Não mover o controlo de acesso GESTOR/ADMIN para fora do service (`assertManager`)
  — o `JwtAuthGuard` por si só não chega.
- Não mover regra de negócio para o controller.
- Não permitir 0 ou >1 opções corretas (manter `validateOpcoes`).
- Não voltar a pôr o seed do banco a apagar sempre o pool (perderia as perguntas
  do gestor) — manter *create-if-absent*.
- Não substituir o banco curado por geração LLM em runtime sem rever testes e a
  invariante "1 opção correta".

## Linkagens

- `../redis` (sessão), `../database` (Prisma), `../auth` (JwtAuthGuard, CurrentUser)
- `../audit` (`AuditService.write` — auditoria da gestão de perguntas)
- Contratos: `../../../../packages/contracts/src/index.ts`
  (`Start/SubmitQuiz*`, `QuizResultResponse`, `QuizHistory*`, `QuizMeResponse`,
  `AdminQuizQuestion`, `Create/UpdateQuizQuestionRequest`, `ListAdminQuizQuestionsResponse`)
- Frontend (gestão): `apps/web/src/routes/_layoutmain.gestao-quiz.tsx`
- Requisitos: `../../../../docs/02-Requisitos/M06-Gamificacao.md`
- Esquema quiz: `../../../../docs/models/Ecopontos, Zonas, Badges e Quiz/quiz/`
