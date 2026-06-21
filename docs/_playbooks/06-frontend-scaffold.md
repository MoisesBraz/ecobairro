# Frontend Scaffold Guide

## Purpose

This document explains the frontend scaffold currently living in `apps/web`.

The goal of this scaffold is not to ship feature UI. Its job is to give the team:

- a stable frontend runtime built with Vite and TanStack Router in SPA mode
- a clear route structure with shared public and authenticated layouts
- a reusable vertical navigation shell and UI primitive set
- a minimal app infrastructure layer for env, auth, HTTP, and query state
- a predictable place for future feature code

## What We Chose

### Runtime

The frontend uses **Vite + TanStack Router** in SPA mode.

Why:

- the runtime is straightforward to reason about during the scaffolding phase
- TanStack Router gives file-based routing with strong TypeScript support
- the current branch keeps a simple client-only bootstrap instead of reintroducing TanStack Start
- this shape fits the current monorepo and Docker workflow cleanly

### Routing

We use **TanStack Router file-based flat routes**.

Why:

- flat route files make ownership easy to find
- `_layoutmain` groups authenticated dashboard pages under one shared shell
- `_layoutpublic` groups public-facing pages without duplicating framing logic
- teammates can add a route by adding a single file in `src/routes`

This is why `src/routes` is treated as the route-authoring surface.

### Data Layer

We provide **TanStack Query** as shared plumbing via `QueryClientProvider` in `main.tsx`.

Why:

- feature teams will need caching, async state, and request lifecycle management
- one app-wide query client avoids each feature inventing its own pattern
- the shared infrastructure is ready without locking in domain-specific hooks too early

Important:

- we did **not** add domain query hooks
- we did **not** add a full API SDK
- we did **not** add server-side auth flows

### Styling

We use **Tailwind v4** plus a shared token layer in `src/styles/globals.css`.

Why:

- Tailwind keeps feature work fast
- the token layer centralizes cross-app colors, surfaces, spacing, and radius choices
- this is enough structure for scaffolding without forcing a heavy design system too early

### Layout

The scaffold provides a shared authenticated shell via `_layoutmain.tsx` and public framing via `_layoutpublic.tsx`.

Authenticated pages inherit:

- a desktop sidebar navigation
- a mobile drawer via `Sheet`
- a top navbar with user actions
- footer framing and shared shell spacing

Authentication is enforced in the authenticated layout route through `requireAuth()`.

## Directory Structure

```text
apps/web/
  src/
    @layouts/
      VerticalLayout.tsx
      components/vertical/
    components/
      layout/
        DashboardLayout.tsx
        Navbar.tsx
        Sidebar.tsx
        shared/
          Logo.tsx
        vertical/
          Footer.tsx
          FooterContent.tsx
          Navbar.tsx
          NavbarContent.tsx
          Navigation.tsx
      ui/
        avatar.tsx
        badge.tsx
        button.tsx
        card.tsx
        dropdown-menu.tsx
        input.tsx
        label.tsx
        pagination-bar.tsx
        progress.tsx
        sheet.tsx
    lib/
      auth.ts
      env.ts
      utils.ts
      http/
        fetch-json.ts
      query/
        client.ts
    mocks/
    routes/
      __root.tsx
      _layoutmain.tsx
      _layoutmain.*.tsx
      _layoutpublic.tsx
      _layoutpublic.home.tsx
      login.tsx
      register.tsx
      forgot-password.tsx
      index.tsx
    styles/
      globals.css
    types/
      index.ts
    routeTree.gen.ts
    main.tsx
```

## Authentication Model

Authentication is scaffolded on the client:

- `sessionStorage.getItem('user')` stores the current `User`
- `requireAuth()` redirects unauthenticated users to `/login`
- `requireRole(allowed)` redirects users without the right role to `/home`
- `_layoutmain` runs the auth guard once so protected child routes inherit it automatically

This is intentionally scaffold-level auth. Replace it with the real NestJS-backed auth flow when the feature work lands.

## Infrastructure Layer

### `src/lib/env.ts`

Centralized env parsing. Route and component files should not read `import.meta.env` directly.

Available vars:

- `VITE_API_BASE_URL` with default `/api`
- `VITE_ANALYTICS_BASE_URL` with default `/analytics`
- `VITE_APP_NAME` with default `ecoBairro`
- `VITE_GOOGLE_CLIENT_ID` as an optional Google OAuth toggle

### `src/lib/http/fetch-json.ts`

Typed fetch wrapper for API calls.

Use it for:

- base URL handling
- query param construction
- JSON or text response parsing
- typed HTTP error handling

### `src/lib/query/client.ts`

Creates the shared `QueryClient` used by the app root.

### `src/lib/utils.ts`

Provides `cn()` for conditional class composition with `clsx` and `tailwind-merge`.

## How The App Boots

1. Vite starts the app from `apps/web/vite.config.ts`.
2. `TanStackRouterVite` scans `src/routes` and generates `src/routeTree.gen.ts`.
3. `main.tsx` creates the query client and mounts `RouterProvider`.
4. `__root.tsx` provides the app-wide providers.
5. `_layoutmain.tsx` applies the authenticated shell and route guard.
6. Route files render into the appropriate shared layout via `<Outlet />`.

## Route Pattern

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layoutmain/feature-name')({
  component: FeaturePage,
})

function FeaturePage() {
  return <div>Feature content</div>
}
```

- auth pages such as `login`, `register`, and `forgot-password` live directly under `src/routes`
- authenticated dashboard pages use the `_layoutmain.<name>.tsx` convention
- public pages can live under `_layoutpublic`
- `routeTree.gen.ts` is generated and should not be edited by hand

## UI Components

`src/components/ui` contains small reusable primitives built around Radix UI and Tailwind.

Current shared primitives include:

- `avatar`
- `badge`
- `button`
- `card`
- `dropdown-menu`
- `input`
- `label`
- `pagination-bar`
- `progress`
- `sheet`

## How To Extend Safely

### Add a new dashboard route

1. Create `src/routes/_layoutmain.<route-name>.tsx`.
2. Use `createFileRoute('/_layoutmain/<route-name>')({...})`.
3. Let TanStack regenerate `routeTree.gen.ts`.
4. Commit both the authored route file and the regenerated route tree.

### Add shared layout components

Place them in `src/components/layout/`.

### Add reusable UI primitives

Place them in `src/components/ui/`.

### Add app-wide infrastructure

Place it in `src/lib/`.

### Add feature-specific code

Keep route-specific logic local to the route file first. Extract a feature folder only after real repeated domain logic appears.

## What Is Intentionally Missing

This scaffold does **not** define:

- real API integrations for the mocked pages
- a production-ready JWT refresh flow
- feature-specific query hooks
- a full design system specification

Those decisions belong to the feature work that will land on top of this scaffold.

## Commands

From the repo root:

```bash
pnpm --filter @ecobairro/web dev
pnpm --filter @ecobairro/web lint
pnpm --filter @ecobairro/web typecheck
pnpm --filter @ecobairro/web build
pnpm --filter @ecobairro/web test
```

## Mental Model

- `routes/` defines where the app goes
- `@layouts/` and `components/layout/` define shared framing and navigation
- `components/ui/` holds small reusable presentational primitives
- `lib/` holds shared non-UI infrastructure
- `routeTree.gen.ts` is generated glue and should stay machine-owned
