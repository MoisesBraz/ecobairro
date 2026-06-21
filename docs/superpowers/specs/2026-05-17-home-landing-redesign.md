# ecoBairro Home — Landing Page Redesign

**Date:** 2026-05-17  
**File:** `apps/web/src/routes/_layoutpublic.home.tsx`  
**Scope:** Guest view only. Authenticated view is unchanged.

---

## Goal

Replace the current minimal guest view with a cinematic dark landing page that communicates the app's value proposition and drives sign-up/login conversion.

---

## Design Direction: Cinematic Dark

Inspired by Airbnb/Duolingo. Full-width hero with dark gradient, central green glow, clear CTA hierarchy, social proof stats, feature cards, and trust bar.

Colors match the existing design system:
- Primary green: `oklch(0.55 0.18 150)` (light) / `oklch(0.65 0.18 150)` (dark)
- Background dark: `#282A42`
- Card dark: `#30334E`
- All via CSS custom properties already defined in `globals.css`

---

## Guest View — New Structure

### 1. Hero Section

Full-width card with layered dark gradient background:
- `linear-gradient(170deg, darkgreen → dark-indigo → near-black)`
- Radial green glow (absolute, centered top)
- Bottom fade to blend into next section

**Contents (top to bottom, centered):**
- Animated badge: green pill, pulsing dot, text "Plataforma de Cidadania Ativa"
- Headline (2 lines, ~28px bold): "O teu bairro / mais **sustentável**" — "sustentável" in primary green
- Subtext (~13px muted): "Reporta problemas, partilha recursos e mede o impacto real da tua comunidade."
- CTA row: `Button` primary ("Entrar na plataforma" with `LogIn` icon) + `Button` outline ("Registar" with `UserPlus` icon) — links to `/login` and `/register`
- Stats pills row (3 pills): Cidadãos · Reports · Resolvidos — values from `feed` where available, fallback to `0`

**Stats source:** `feed?.impacto?.comunidade_pax` is the only community-wide stat available to unauthenticated requests. Report totals and resolution rates are user-specific and return 0 for guests.

Social proof pills use static values hardcoded in the component constant — these are marketing copy, not live data. Update them manually when the platform grows:

```ts
const COMMUNITY_STATS = {
  cidadaos: 1200,
  reports: 340,
  resolvidos: 89, // percent
}
```

`feed?.impacto?.comunidade_pax` overrides `COMMUNITY_STATS.cidadaos` if present and > 0.

### 2. Feature Cards (3 columns)

Three glassmorphism-style cards below the hero, inside a `grid-cols-1 sm:grid-cols-3` grid.

| Icon (Lucide) | Title | Description |
|---|---|---|
| `FileText` | Reportes | Envia problemas com foto e localização diretamente para a câmara |
| `MapPin` | Ecopontos | Mapa de pontos de reciclagem com disponibilidade em tempo real |
| `TrendingUp` | Impacto | Acompanha a tua contribuição ambiental e compara com os vizinhos |

Card style: `bg-card border border-border/70 rounded-xl`, icon in `bg-primary/10 rounded-xl` pill, no hover interaction needed.

### 3. Trust Bar

Single full-width row, `bg-card border border-border/70 rounded-xl p-4`.

- Left: 4 stacked avatar circles (CSS-only, colored with `bg-primary/60`, `bg-primary/40`, `bg-blue-400/60`, `bg-purple-400/60`)
- Center text: "Juntos com **X vizinhos** ativos no ecoBairro" — X from `feed?.impacto?.comunidade_pax ?? 1200`
- Right: 5 yellow stars (Unicode `★★★★★`, `text-yellow-400`)

### 4. News Section

Unchanged from current implementation. Rendered for both guest and auth.

---

## Authenticated View

**No changes.** All existing sections (banner with gamification, quick shortcuts, ecopontos, alert, impacto, reports, partilhas, noticias) remain exactly as currently implemented.

---

## Implementation Constraints

- No new dependencies
- All icons from `lucide-react` (already imported)
- No new files — single file edit: `_layoutpublic.home.tsx`
- `Button` component already available at `@/components/ui/button`
- Must work in both light and dark mode (use CSS custom properties)
- `prefers-reduced-motion`: pulse animation on badge dot must respect it
- Touch targets ≥ 44px on CTAs

---

## Out of Scope

- Changes to the auth view
- New API endpoints
- Actual community stats (use `feed` data as-is, fallback to 0)
- Animations beyond the badge pulse dot
