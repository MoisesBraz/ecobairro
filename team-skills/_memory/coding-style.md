---
usf: false
summary: EcoBairro coding conventions — NestJS backend, TanStack Router frontend, Prisma ORM, Tailwind v4, TypeScript strict.
---

# Coding Style — EcoBairro

Guidelines referenced by skills via `[[coding-style]]`.

## General

- Clarity beats cleverness. If two equivalent solutions exist, pick the more readable one.
- Names describe intent, not implementation. `retryCount`, not `rc`.
- Small functions (≤30 lines); one reason to change each.
- Delete dead code — don't comment it out.
- All code is TypeScript (strict mode) unless it is the analytics service (Python/FastAPI).

## Comments

- Default: no comment.
- Write a comment only when the WHY is non-obvious (hidden constraint, workaround, surprising behavior).
- Never restate the code.

## Errors

- Validate at boundaries (user input, external APIs).
- Trust internal invariants — don't defensive-check every call.
- Fail fast with a clear message; don't silently swallow.

## Testing

- One behavior per test.
- Test names describe what, not how: `returns_empty_list_when_no_matches`.
- API tests: service-level unit tests near the module (`*.test.ts`).
- Frontend tests: route and component tests with Testing Library.
- Run `pnpm --dir apps/api test` or `pnpm --filter @ecobairro/web test` from the repo root.

## Backend (NestJS / `apps/api`)

- Module pattern: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `dto/`.
- Controllers own HTTP concerns only — no business logic.
- Services own business logic — Prisma and Redis access stays behind service boundaries.
- DTOs enforce runtime validation with `class-validator` + `class-transformer`.
- Contracts (`packages/contracts`) define the API shape; DTOs enforce it at runtime.
- Use `@UseGuards(JwtAuthGuard)` for authenticated routes.
- Use `@CurrentUser()` decorator to access the authenticated user.
- Role checks live in the service, not the controller.
- Global prefix is `/v1`; health endpoints (`/health`, `/ready`) are excluded.
- Global validation pipe: whitelist enabled, forbid non-whitelisted, transform enabled.

## Frontend (TanStack Router / `apps/web`)

- Routes are authored in `src/routes/` using `createFileRoute(...)`.
- Do NOT edit `src/routeTree.gen.ts` — it is generated.
- Layout route uses `_layoutmain` prefix (flat routes pattern).
- Use `@/` path alias for imports (resolves to `src/`).
- UI primitives live in `src/components/ui/` (shadcn/ui based).
- Layout components live in `src/components/layout/`.
- Shared non-UI infrastructure lives in `src/lib/`.
- Styling: Tailwind v4 + CSS variables in `src/styles/globals.css`.
- Use `clsx` + `tailwind-merge` via the `cn()` utility for class composition.
- Forms: `react-hook-form` + `zod` for validation.
- Icons: `lucide-react` and `remixicon`.
- Maps: `leaflet` + `react-leaflet`.
- Theme: `next-themes` with `class` attribute strategy.

## Prisma (Database)

- Schema lives at `apps/api/prisma/schema.prisma`.
- Model names: PascalCase (`User`, `CidadaoPerfil`).
- Table names: snake_case via `@@map("table_name")`.
- Column names: camelCase in Prisma, snake_case in DB via `@map("column_name")`.
- Timestamps: `criadoEm` / `atualizadoEm` / `eliminadoEm` (soft-delete pattern).
- IDs: UUID via `gen_random_uuid()`.
- Use `@db.Timestamptz(6)` for all timestamp columns.
- Migrations are committed and reviewed.
- Use raw SQL in migrations for PostgreSQL-specific features (partial indexes, PostGIS, extensions).

## Monorepo

- Run all commands from the repository root.
- Use `pnpm --filter <package>` or `pnpm --dir <path>` for targeted commands.
- Never run `pnpm install` inside `apps/*` or `packages/*`.
- One lockfile at the root: `pnpm-lock.yaml`.
- Shared contracts go in `packages/contracts/src/index.ts`.
- Shared config utilities go in `packages/config/`.

## Commits & PRs

- Conventional Commits: `feat(api): add report submission flow`.
- Valid scopes: `api`, `web`, `analytics`, `contracts`, `config`, `infra`, `docs`.
- PRs merged via Squash — PR title becomes the commit message.
- Branch prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`.
