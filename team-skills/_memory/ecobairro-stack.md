---
usf: false
summary: EcoBairro tech stack reference — monorepo structure, services, dependencies, infrastructure, and local runtime.
---

# EcoBairro Tech Stack

Referenced by skills via `[[ecobairro-stack]]`.

## Monorepo Structure

```
ecobairro/
  apps/
    web/          → React SPA (TanStack Router + Vite)
    api/          → NestJS REST API
    analytics/    → FastAPI analytics service (Python)
  packages/
    contracts/    → Shared TypeScript interfaces (API shapes)
    config/       → Shared config utilities
    eslint-config/→ Shared ESLint config
    tsconfig/     → Shared TypeScript configs
  infra/
    compose/      → Docker Compose orchestration
    nginx/        → Reverse proxy config
    postgres/     → PostGIS init scripts
    scripts/      → Container startup scripts
  docs/           → Teammate-facing documentation
  team-skills/    → USF skills for AI-assisted development
```

## Package Manager

- **pnpm** (v10.30+) with Corepack
- Workspace defined in `pnpm-workspace.yaml`: `apps/*` and `packages/*`
- Single lockfile at root: `pnpm-lock.yaml`
- All commands run from the repository root

## Frontend — `apps/web`

| Concern | Choice |
|---|---|
| Framework | React 19 |
| Routing | TanStack Router (file-based, flat routes with `_layoutmain` prefix) |
| Data fetching | TanStack Query v5 (`useQuery`, `QueryClientProvider`) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 + CSS variables |
| UI components | shadcn/ui (Radix primitives) |
| Forms | react-hook-form + zod |
| Icons | lucide-react, remixicon |
| Maps | Leaflet + react-leaflet |
| Theme | next-themes (class-based) |
| Google OAuth | @react-oauth/google |
| Path alias | `@/` → `src/` |

## Backend — `apps/api`

| Concern | Choice |
|---|---|
| Framework | NestJS 10 |
| Language | TypeScript (tsx for dev) |
| ORM | Prisma 7 (PostgreSQL adapter) |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache/Sessions | Redis 7 (ioredis) |
| Auth | JWT (@nestjs/jwt) + bcrypt |
| Validation | class-validator + class-transformer |
| Dev runner | tsx watch |
| Test runner | tsc + node (no Jest) |

## Analytics — `apps/analytics`

| Concern | Choice |
|---|---|
| Framework | FastAPI |
| Language | Python |
| Server | Uvicorn |
| Database | PostgreSQL (read replica planned) |

## Infrastructure

| Component | Detail |
|---|---|
| Orchestration | Docker Compose |
| Reverse proxy | Nginx 1.27 on port 8080 |
| Database | PostGIS/PostgreSQL 16-3.4 on port 5432 |
| Cache | Redis 7 Alpine |
| Local entrypoint | `http://localhost:8080` |

## Routing Model

- Nginx routes: `/` → web, `/api/` → api, `/analytics/` → analytics
- NestJS global prefix: `/v1` (health excluded)
- External API routes: `/api/v1/...`
- Health: `/api/health`, `/api/ready`, `/analytics/health`, `/analytics/ready`

## Key Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_ACCESS_SECRET` — JWT signing secret
- `JWT_ACCESS_TTL_MINUTES` — Access token TTL (default: 15)
- `REFRESH_TOKEN_TTL_DAYS` — Refresh token TTL (default: 7)
- `BCRYPT_ROUNDS` — Password hashing rounds (default: 12)
- `VITE_API_BASE_URL` — Frontend API base URL (`/api`)
- `VITE_ANALYTICS_BASE_URL` — Frontend analytics base URL (`/analytics`)
- `VITE_APP_NAME` — Application display name (defaults to `ecoBairro`)
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID (optional)
