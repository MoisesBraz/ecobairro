# Home Landing Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the guest view of the home page with a cinematic dark landing page (hero + feature cards + trust bar) while leaving the authenticated view completely untouched.

**Architecture:** Single file edit. Three new helper components (`GuestHero`, `GuestFeatures`, `GuestTrustBar`) added above `HomePage`. Old `isGuest` guest block replaced with these components. Auth view code is not touched.

**Tech Stack:** React, TypeScript, Tailwind v4, Lucide icons (already imported), shadcn `Button` (already imported)

---

## File Map

| File | Change |
|------|--------|
| `apps/web/src/routes/_layoutpublic.home.tsx` | Add `COMMUNITY_STATS` constant, add `GuestHero` / `GuestFeatures` / `GuestTrustBar` components, replace old guest JSX block in `HomePage` |

---

### Task 1: Add `COMMUNITY_STATS` constant and import `UserPlus`

**Files:**
- Modify: `apps/web/src/routes/_layoutpublic.home.tsx`

- [ ] **Step 1: Add `UserPlus` to the lucide-react import line**

Find the existing import:
```ts
import {
  MapPin, TrendingUp, ChevronRight, Star, AlertTriangle, Recycle, Users, Leaf,
  FileText, CheckCircle, Package, Gift, Newspaper, Calendar, Clock,
  PlusCircle, Truck, Trophy, LogIn, UserPlus,
} from 'lucide-react'
```

`LogIn` and `UserPlus` are already present from the previous session — verify they are there. If missing, add them.

- [ ] **Step 2: Add `COMMUNITY_STATS` constant directly after the `ecoState` function (before the `SectionHeader` helper)**

```ts
const COMMUNITY_STATS = {
  cidadaos: 1200,
  reports: 340,
  resolvidos: 89, // percent — update manually as platform grows
} as const
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Add `GuestHero` component

**Files:**
- Modify: `apps/web/src/routes/_layoutpublic.home.tsx`

Add `GuestHero` directly after the `COMMUNITY_STATS` constant.

- [ ] **Step 1: Write `GuestHero`**

```tsx
function GuestHero({ cidadaos }: { cidadaos: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl text-center px-6 py-16"
      style={{
        background:
          'linear-gradient(170deg, color-mix(in srgb, var(--primary) 18%, #0f1a12) 0%, #1a1d2e 50%, #0d0f1a 100%)',
      }}
    >
      {/* Radial glow — centered top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[220px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: 'linear-gradient(transparent, #0d0f1a)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Animated badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold tracking-wide text-[var(--primary)]">
            Plataforma de Cidadania Ativa
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white">
            O teu bairro<br />
            mais <span className="text-[var(--primary)]">sustentável</span>
          </h1>
          <p className="text-sm text-white/55 max-w-xs mx-auto leading-relaxed">
            Reporta problemas, partilha recursos e mede o impacto real da tua comunidade.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Button
            asChild
            className="gap-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white min-h-[44px] px-6 font-semibold"
          >
            <Link to="/login">
              <LogIn className="w-4 h-4" />
              Entrar na plataforma
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="gap-2 min-h-[44px] px-6 border-white/20 text-white/80 hover:bg-white/10 hover:text-white bg-transparent font-semibold"
          >
            <Link to="/register">
              <UserPlus className="w-4 h-4" />
              Registar
            </Link>
          </Button>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {[
            { value: cidadaos.toLocaleString('pt-PT'), label: 'Cidadãos' },
            { value: COMMUNITY_STATS.reports.toLocaleString('pt-PT'), label: 'Reports' },
            { value: `${COMMUNITY_STATS.resolvidos}%`, label: 'Resolvidos' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/10"
            >
              <span className="text-lg font-black text-white leading-none">{s.value}</span>
              <span className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3: Add `GuestFeatures` and `GuestTrustBar` components

**Files:**
- Modify: `apps/web/src/routes/_layoutpublic.home.tsx`

Add both components after `GuestHero`.

- [ ] **Step 1: Add `GUEST_FEATURES` constant and `GuestFeatures` component**

```tsx
const GUEST_FEATURES = [
  {
    icon: FileText,
    title: 'Reportes',
    desc: 'Envia problemas com foto e localização diretamente para a câmara municipal.',
  },
  {
    icon: MapPin,
    title: 'Ecopontos',
    desc: 'Mapa de pontos de reciclagem com disponibilidade em tempo real.',
  },
  {
    icon: TrendingUp,
    title: 'Impacto',
    desc: 'Acompanha a tua contribuição ambiental e compara com os vizinhos.',
  },
] as const

function GuestFeatures() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {GUEST_FEATURES.map((f) => {
        const Icon = f.icon
        return (
          <div
            key={f.title}
            className="flex items-start gap-4 rounded-xl bg-card border border-border/70 p-5 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add `GuestTrustBar` component**

```tsx
const AVATAR_COLORS = [
  'bg-[var(--primary)]/60',
  'bg-[var(--primary)]/40',
  'bg-blue-400/60',
  'bg-purple-400/60',
] as const

function GuestTrustBar({ cidadaos }: { cidadaos: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card border border-border/70 px-5 py-4 shadow-sm">
      {/* Stacked avatars */}
      <div className="flex shrink-0" aria-hidden="true">
        {AVATAR_COLORS.map((cls, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full border-2 border-card shrink-0 ${cls}${i > 0 ? ' -ml-2' : ''}`}
          />
        ))}
      </div>
      {/* Text */}
      <p className="text-sm text-muted-foreground flex-1 min-w-0">
        Juntos com{' '}
        <span className="font-bold text-foreground">
          {cidadaos.toLocaleString('pt-PT')} vizinhos
        </span>{' '}
        ativos no ecoBairro
      </p>
      {/* Stars */}
      <span
        className="text-yellow-400 text-base shrink-0 select-none"
        aria-label="Classificação 5 estrelas"
      >
        ★★★★★
      </span>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

### Task 4: Wire guest components into `HomePage` — replace old guest block

**Files:**
- Modify: `apps/web/src/routes/_layoutpublic.home.tsx`

- [ ] **Step 1: Compute `cidadaosCount` inside `HomePage`**

Inside `HomePage`, after the `const impacto = feed?.impacto` line, add:

```ts
const cidadaosCount = feed?.impacto?.comunidade_pax || COMMUNITY_STATS.cidadaos
```

- [ ] **Step 2: Replace the old guest JSX block**

The current guest block (inside the main `return`) looks like this — find and replace it entirely:

**Remove** (the old guest hero card + feature highlights grid):
```tsx
{/* ── 1. Banner principal ── */}
<Card
  className="relative overflow-hidden border-none shadow-sm"
  style={{ background: 'linear-gradient(135deg, ...)' }}
>
  <HeroBlob />
  <CardContent ...>
    ...isGuest...
  </CardContent>
</Card>

{/* ── 1b. Guest: feature highlights ── */}
{isGuest && (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {guestFeatures.map(...)}
  </div>
)}
```

**Replace with** this structure at the top of the `return` block — keeping everything else below unchanged:

```tsx
return (
  <div className="flex flex-col gap-8 pb-12 max-w-2xl mx-auto lg:max-w-none">

    {isGuest ? (
      /* ── Guest: cinematic landing ── */
      <>
        <GuestHero cidadaos={cidadaosCount} />
        <GuestFeatures />
        <GuestTrustBar cidadaos={cidadaosCount} />
      </>
    ) : (
      /* ── Auth: existing banner (unchanged) ── */
      <Card
        className="relative overflow-hidden border-none shadow-sm"
        style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--primary) 10%, var(--card)) 0%, var(--card) 65%)' }}
      >
        <HeroBlob />
        <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{greeting} 👋</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Olá, <span className="text-[var(--primary)]">{firstName}</span>!
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Aqui está o resumo da sua atividade no ecoBairro.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end min-w-[200px]">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--primary)]/10 rounded-full px-2.5 py-1">
                <Star className="w-3 h-3 text-[var(--primary)]" fill="currentColor" />
                <span className="text-xs font-semibold text-[var(--primary)]">{gamification.nivel}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                <Counter to={gamification.pontos} /> pts
              </span>
            </div>
            <Progress value={progressoGamificacao} className="h-2 w-full [&>div]:bg-[var(--primary)]" />
            <p className="text-[11px] text-muted-foreground">
              Faltam <span className="font-semibold text-foreground">{pontosRestantes} pts</span> para{' '}
              <span className="font-medium">{reportStats.proximoNivel}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    )}

    {/* ── Auth-only sections ── */}
    {!isGuest && (
      <>
        {/* ... rest of auth sections unchanged ... */}
      </>
    )}

    {/* ── News (both guest + auth) ── */}
    <section className="space-y-4">
      {/* ... news section unchanged ... */}
    </section>

  </div>
)
```

> **Note:** The `!isGuest && (<>...</>)` block and the news section already exist — do not duplicate them. Only restructure the top of the `return` to use the ternary `isGuest ? <GuestHero.../> : <AuthHero.../>`.

- [ ] **Step 3: Remove dead code**

After the refactor, remove:
- The `guestFeatures` array (replaced by `GUEST_FEATURES`)
- The `HeroBlob` function is still used in the auth hero — keep it

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

### Task 5: Visual verification + commit

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 2: Verify guest view at `http://localhost:5173/home` (not logged in)**

Check:
- [ ] Dark cinematic hero renders with visible green glow
- [ ] Badge has pulsing green dot
- [ ] Headline "O teu bairro / mais sustentável" with green accent
- [ ] Two CTA buttons (Entrar + Registar) are visible and ≥ 44px tall
- [ ] Three stats pills show (1.200, 340, 89%)
- [ ] Three feature cards below with correct Lucide icons
- [ ] Trust bar with stacked avatars and ★★★★★
- [ ] News section appears below
- [ ] Works in light mode AND dark mode (toggle via browser DevTools body class)

- [ ] **Step 3: Verify auth view is unchanged**

Log in and confirm all existing sections render identically to before.

- [ ] **Step 4: Check `prefers-reduced-motion`**

In DevTools → Rendering → Emulate CSS media: `prefers-reduced-motion: reduce` — badge dot should stop pulsing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_layoutpublic.home.tsx
git commit -m "feat(home): cinematic dark landing page for guest view

Replace minimal guest view with full landing page: dark gradient hero
with green glow, animated badge, headline, CTAs, social proof stats,
feature cards (Reportes/Ecopontos/Impacto), and trust bar.
Authenticated view unchanged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
