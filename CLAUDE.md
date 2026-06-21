# EcoBairro

Plataforma de descoberta de **ecopontos** (pontos de reciclagem), reportes de
cidadãos, telemetria de sensores e suporte aos fluxos operacionais de resíduos.

> Wiki detalhada gerada em `.repowiki/` (começar por `.repowiki/index.md`).
> Cada módulo do backend tem o seu próprio `CLAUDE.md` (ex.:
> `apps/api/src/admin/CLAUDE.md`) — consultar antes de mexer no módulo.

## Estrutura (monorepo pnpm)

```text
apps/
  web/         # Frontend — TanStack Start + React + TypeScript
  api/         # Backend — NestJS + TypeScript (Prisma)
  analytics/   # Serviço de analítica — FastAPI (Python)
packages/
  contracts/   # Tipos/contratos partilhados (DTOs, respostas de erro)
  config/      # Config/env partilhada (requireEnv)
  tsconfig/    # tsconfig base
  eslint-config/
infra/         # Docker Compose + Nginx
```

## Stack

- **DB**: PostgreSQL + PostGIS; ORM **Prisma** (`apps/api/prisma/schema.prisma`).
  PostGIS ativado na migração `20260620120000_postgis_ecopontos_geom`:
  `ecopontos.geom` é uma coluna `geometry(Point,4326)` **gerada** de `lng/lat` (STORED)
  com índice GiST — lat/lng continuam a ser a fonte de verdade. O Prisma vê-a como
  `Unsupported(...)`; consultas geo (ST_DWithin/ST_Distance) vivem no serviço analytics.
- **Cache/filas**: Redis (cache + BullMQ).
- **Proxy**: Nginx em `localhost:8080` (entrada única em dev).
- **Analytics (geo/leituras)**: serviço **FastAPI** em `apps/analytics/` (CQRS-lite),
  exposto em `/analytics/`. Verifica o JWT HS256 do NestJS. Detalhe e invariantes em
  `apps/analytics/CLAUDE.md`. O `/v1/analytics` (KPIs de reports) **continua** em NestJS
  (`apps/api/src/analytics/`).

## Comandos

```bash
pnpm compose:up        # sobe a stack (nginx, postgres, redis, api, web, analytics)
pnpm compose:down      # baixa a stack
pnpm compose:logs:api  # logs do backend

pnpm --dir apps/api exec prisma generate         # gera o Prisma Client (necessário p/ typecheck)
pnpm --dir apps/api exec prisma migrate deploy   # aplica migrações

pnpm lint              # lint de todos os pacotes/apps
pnpm typecheck         # typecheck de todos (correr `prisma generate` antes)
pnpm test              # testes api + web
```

Nota: `pnpm typecheck`/`lint` falham se o Prisma Client não estiver gerado —
correr `pnpm --dir apps/api exec prisma generate` primeiro.

## Autenticação

- JWT **access token** curto no header `Authorization: Bearer`.
- **Refresh token** em cookie HttpOnly (tabela `ActiveSession`); 2FA opcional.
- Revogação imediata via Redis (`SecurityService.revokeUser`) +
  `SessionService.revokeAll` — o `JwtAuthGuard` só bloqueia via chave de
  revogação no Redis, por isso o soft-delete por si só não chega.

## Modelo de utilizador & eliminação

- Tabela `users`, `email @unique`, soft delete via `eliminadoEm` (nullable).
  Login bloqueia se `eliminadoEm != null` (`apps/api/src/auth/auth.service.ts`).
- **Eliminar utilizador (admin)** = `DELETE /api/v1/admin/users/:id` →
  **soft delete anonimizado**: nunca remove a linha (preserva histórico
  operacional), mas **liberta o email original** (reescreve para
  `anon_<id>@anon.invalid`) e limpa a PII (password/telefone/2FA, nome do
  perfil, `autorNome` das partilhas). Sem libertar o email, a pessoa não
  conseguiria recriar conta com o mesmo email. Detalhe em
  `apps/api/src/admin/CLAUDE.md`.
- `PATCH /api/v1/admin/users/:id/reativar` desfaz o soft delete (mas os dados
  permanecem anónimos — não é um "undo" da anonimização).

## Gamificação & Quiz

- Quiz **jogável** sobre lixo/reciclagem em `/api/v1/gamification/*` — detalhe e
  invariantes em `apps/api/src/gamification/CLAUDE.md`. Frontend: rota
  `apps/web/src/routes/_layoutmain.quiz.tsx` + `apps/web/src/components/quiz/`.
- **Perguntas aleatórias** = sorteio (Fisher-Yates) de N perguntas de um **banco
  curado** PT-PT (`apps/api/prisma/quiz-bank.ts`, seedado como pool `Quiz`).
  **Não** há geração por LLM/ML em runtime (offline, testável, 1 resposta certa).
- **Opt-in estrito** (RF-18): `CidadaoPerfil.gamificationOptIn`; `iniciar`/
  `responder` devolvem 403 sem adesão. **Sessão** em Redis `quiz:sessao:{id}`
  (TTL 30 min). O campo `correta` **nunca** é enviado ao cliente antes do
  resultado; feedback educativo é sempre mostrado (RF-19).
- **Pontos**: `reports*100 + partilhas*50 + Σ score do quiz`. Níveis/conquistas
  continuam calculados dinamicamente (não persistidos).
- **Gestão de perguntas (GESTOR/ADMIN)**: CRUD do banco em
  `/api/v1/admin/quiz/perguntas` (`GET`/`POST`/`PATCH`/`DELETE`) — acesso por
  `assertManager`, valida 1 opção correta + 2-6 opções, auditado. UI em
  `apps/web/src/routes/_layoutmain.gestao-quiz.tsx`. O seed do banco é
  *create-if-absent* (re-seed não apaga perguntas do gestor).
