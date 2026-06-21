---
usf: false
summary: EcoBairro implementation patterns — contract-first API, NestJS modules, TanStack Router routes, auth guards, Prisma models.
---

# EcoBairro Implementation Patterns

Referenced by skills via `[[ecobairro-patterns]]`.

## Contract-First API Design

1. Define request/response interfaces in `packages/contracts/src/index.ts`
2. Create DTOs in the NestJS module that mirror the contract with `class-validator` decorators
3. Implement the controller and service
4. The frontend consumes the contract types directly from `@ecobairro/contracts`

## NestJS Module Structure

```
src/<feature>/
  <feature>.module.ts        → NestJS module declaration
  <feature>.controller.ts    → HTTP route handlers (no business logic)
  <feature>.service.ts       → Business logic (Prisma/Redis access)
  <feature>.service.test.ts  → Unit tests
  dto/
    <action>.dto.ts          → Request validation DTOs
```

Register new modules in `src/app.module.ts` imports array.

## Auth Guard Pattern

```typescript
// Protected endpoint
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@CurrentUser() user: AuthUser) {
  return this.service.getProfile(user.userId);
}
```

- `JwtAuthGuard` verifies the Bearer token and attaches `request.authUser`
- `@CurrentUser()` extracts `{ userId, role }` from the request
- Role enforcement happens in the service, not the controller

## JWT Payload

```json
{ "sub": "<user_id>", "role": "CIDADAO" }
```

## Redis Session Model

- Key: `user:session:{user_id}`
- One active refresh session per user
- New login replaces old session

## TanStack Router Route Pattern

```tsx
// src/routes/_layoutmain.feature-name.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layoutmain/feature-name')({
  component: FeatureNamePage,
})

function FeatureNamePage() {
  return <div>Feature content</div>
}
```

- File naming: `_layoutmain.<route-name>.tsx` for pages inside the main layout
- Auth pages (login, register, forgot-password): directly in `src/routes/` without layout prefix
- The `_layoutmain.tsx` layout provides: vertical navigation, navbar, footer, mobile drawer

## Frontend Component Patterns

### shadcn/ui components (`src/components/ui/`)
- Based on Radix UI primitives
- Styled with Tailwind + `cn()` utility
- Examples: `button.tsx`, `card.tsx`, `input.tsx`, `sheet.tsx`, `dropdown-menu.tsx`

### Layout components (`src/components/layout/`)
- Vertical layout with collapsible sidebar
- Navbar with user menu
- Footer
- Mobile navigation via Sheet (drawer)

## Prisma Model Conventions

```prisma
model ExampleModel {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String    @unique @map("user_id") @db.Uuid
  someField    String    @map("some_field")
  criadoEm     DateTime  @default(now()) @map("criado_em") @db.Timestamptz(6)
  atualizadoEm DateTime  @updatedAt @map("atualizado_em") @db.Timestamptz(6)
  eliminadoEm  DateTime? @map("eliminado_em") @db.Timestamptz(6)

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("example_models")
}
```

## Validation Pipe (Global)

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

Extra body fields are rejected automatically. DTOs are the request contract.

## Common Commands

```powershell
# Stack management
pnpm compose:up              # Start all services
pnpm compose:down            # Stop all services
pnpm compose:ps              # Check container health
pnpm compose:logs:api        # Stream API logs

# Development
pnpm --filter @ecobairro/web dev     # Frontend dev server
pnpm --dir apps/api dev              # API dev server

# Validation
pnpm lint                    # All packages
pnpm typecheck               # All packages
pnpm --dir apps/api test     # API tests
pnpm --filter @ecobairro/web build   # Frontend build

# Database
pnpm --dir apps/api exec prisma migrate dev --name <name>
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api prisma:generate
```
