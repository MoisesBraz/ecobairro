---
name: frontend-route-scaffold
description: Generates a new TanStack Router page for EcoBairro's apps/web with layout integration, auth guard, and data fetching via fetchJson + useQuery.
version: 2.0.0
author: ecobairro-team
tags: [frontend, react, routing, ecobairro]
recommended_temperature: 0.2
max_tokens: 3000
inputs:
  - name: route_name
    type: string
    required: true
    description: "The route name (e.g. 'ecopontos', 'perfil', 'reports'). Becomes the URL segment."
  - name: description
    type: string
    required: true
    description: "Brief description of what this page shows or does."
  - name: needs_auth
    type: string
    required: false
    default: "yes"
    description: "Whether this page requires authentication: yes or no. Dashboard routes inherit auth from _layoutmain — only override for standalone pages."
  - name: needs_api
    type: string
    required: false
    default: "yes"
    description: "Whether this page fetches data from the API: yes or no."
  - name: layout
    type: string
    required: false
    default: "_layoutmain"
    description: "Layout to use. '_layoutmain' for authenticated dashboard pages. 'none' for standalone pages like login/register."
  - name: roles
    type: string
    required: false
    default: ""
    description: "Comma-separated roles that may access this route, e.g. 'admin,tecnico_autarquia'. Leave empty if all authenticated users can access."
---

# Role
You are a senior React developer on the EcoBairro team. You scaffold new frontend pages following the established TanStack Router patterns, infrastructure conventions, and coding style of the project.

# Task
Generate the complete code for a new frontend route:

Route name: **{{route_name}}**
Description: {{description}}
Requires auth: {{needs_auth}}
Needs API data: {{needs_api}}
Layout: {{layout}}
Allowed roles: {{roles}}

# Context
Follow the patterns from [[ecobairro-patterns]] and the coding style from [[coding-style]].
Stack reference: [[ecobairro-stack]]

## Current frontend structure

```
apps/web/src/
  routes/
    __root.tsx                     ← root (ThemeProvider, GoogleOAuthProvider)
    _layoutmain.tsx                ← auth guard + vertical layout (sidebar, navbar, footer)
    _layoutmain.<name>.tsx         ← dashboard pages (all behind auth)
    login.tsx                      ← standalone (no layout, no auth guard)
    register.tsx                   ← standalone
    forgot-password.tsx            ← standalone
    index.tsx                      ← redirects to /home
  components/
    layout/vertical/               ← Navigation, Navbar, Footer (layout internals — don't touch)
    ui/                            ← shadcn/ui primitives: Button, Card, Input, Label, Badge,
                                      Progress, Sheet, Avatar, DropdownMenu, etc.
  lib/
    env.ts                         ← clientEnv — VITE_* vars (NEVER use import.meta.env directly)
    auth.ts                        ← getUser(), requireAuth(), requireRole(roles[])
    utils.ts                       ← cn() class merge utility
    http/
      fetch-json.ts                ← fetchJson<T>(), HttpError
    query/
      client.ts                    ← createQueryClient() — already wired in main.tsx
  types/
    index.ts                       ← UserRole, User, NavItem
  styles/
    globals.css                    ← Tailwind v4 + CSS token variables (--primary, --card, etc.)
```

## Key conventions

### File naming
- Dashboard page (inside main layout): `src/routes/_layoutmain.<route-name>.tsx`
- Standalone page (login, register): `src/routes/<route-name>.tsx`

### Route creation
```tsx
// Dashboard page
export const Route = createFileRoute('/_layoutmain/<route-name>')({
  component: RouteNamePage,
})

// With role restriction (add before layout renders)
export const Route = createFileRoute('/_layoutmain/<route-name>')({
  beforeLoad: requireRole(['admin', 'tecnico_autarquia']),
  component: RouteNamePage,
})
```

### API data fetching (when needs_api = yes)
```tsx
import { useQuery } from '@tanstack/react-query'
import { fetchJson, HttpError } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'

const { data, isPending, isError, error } = useQuery({
  queryKey: ['<route-name>'],
  queryFn: () =>
    fetchJson<MyResponseType>('/v1/<resource>', {
      baseUrl: clientEnv.apiBaseUrl,
    }),
})
```

### Loading and error states
```tsx
if (isPending) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">A carregar...</div>
if (isError) return <div className="text-destructive text-sm">{error instanceof HttpError ? `Erro ${error.status}` : 'Algo correu mal.'}</div>
```

### Styling
- Use Tailwind v4 utilities with CSS token variables: `text-[var(--primary)]`, `bg-[var(--card)]`, `border-[var(--border)]`
- Shorthand Tailwind tokens also work: `text-primary`, `bg-card`, `text-muted-foreground`
- Class merging: `cn()` from `@/lib/utils`
- Icons: `lucide-react` only

# Constraints
- DO use the correct file naming convention based on layout choice.
- DO use `createFileRoute(...)` from `@tanstack/react-router`.
- DO use `fetchJson` + `useQuery` for all API calls — never raw `fetch()`.
- DO import env vars through `clientEnv` from `@/lib/env` — never `import.meta.env`.
- DO use `requireRole([...])` in `beforeLoad` when roles are restricted.
- DO use shadcn/ui components and Tailwind v4 for all UI.
- DO include TypeScript types for all data structures.
- DO NOT edit `routeTree.gen.ts` — it regenerates automatically.
- DO NOT add global providers inside route files.
- DO NOT hardcode API base URLs — always use `clientEnv.apiBaseUrl`.
- DO NOT use raw `sessionStorage` reads in components — use `getUser()` from `@/lib/auth`.

# Output Format

### File to Create
```
apps/web/src/routes/<filename>.tsx
```

### Route Code
```tsx
// apps/web/src/routes/<filename>.tsx
...
```

### API Contract Types (if needs_api = yes)
```typescript
// Add to packages/contracts/src/index.ts
export interface <ResourceName> {
  id: string
  // ...
}
```

### New UI Components (only if genuinely reusable across routes)
```tsx
// apps/web/src/components/ui/<component>.tsx
...
```

### After Scaffolding
- [ ] Run `pnpm --filter @ecobairro/web dev` — TanStack will regenerate `routeTree.gen.ts`
- [ ] Commit `routeTree.gen.ts` alongside the new route file
- [ ] Add nav entry to `src/components/layout/vertical/Navigation.tsx` if needed
- [ ] Run `pnpm --filter @ecobairro/web typecheck` before opening a PR
