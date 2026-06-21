---
usf: false
summary: EcoBairro domain vocabulary — citizens, ecopoints, zones, reports, waste collection, gamification, roles, and RGPD.
---

# EcoBairro Glossary

Domain vocabulary referenced by skills via `[[company-glossary]]`.

## Core Entities

- **Cidadão** — a registered citizen user. The primary end-user of the platform. Role: `CIDADAO`.
- **Ecoponto** — a waste collection point (recycling bin, container). Has GPS coordinates, type, and operational status.
- **Zona** — a geographic zone (neighborhood area). Groups ecopoints and citizens for operational and gamification purposes.
- **Report** — a citizen-submitted issue report about waste or infrastructure problems. Has status lifecycle and timeline.
- **Recolha** — a bulky waste collection request (`pedidos_recolha`). Scheduled by operators.
- **Partilha** — a material sharing post between citizens within a zone (`partilhas_materiais`).

## Gamification

- **Badge** — an achievement badge earned by citizens for eco-friendly actions.
- **Quiz** — an educational quiz about recycling and sustainability.
- **Gamification Opt-In** — citizen preference to participate in gamification features (`gamification_opt_in`).

## Roles

- **CIDADAO** — citizen (end-user). Self-registers. Can submit reports, request collections, share materials.
- **OPERADOR** — Veolia operator. Drives the vehicle and executes waste collection routes.
- **GESTOR** — Backoffice manager (Veolia/Autarquia). Plans routes, assigns teams, and manages the fleet.
- **TECNICO_AUTARQUIA** — municipal technician. Manages zones, ecopoints, and campaigns.
- **TECNICO_CCDR** — CCDR technician. Regional oversight role.
- **ADMIN** — platform administrator. Full access.

## Operations

- **Rota de Execução** — an operator's waste collection route execution record.
- **Campanha de Benefício** — a benefit campaign tied to a zone (incentives for recycling).
- **Mensagem Institucional** — institutional message broadcast to zones.
- **Notificação** — a user notification (in-app, push).
- **Audit Log** — append-only record of sensitive operations.

## Technical Terms

- **RGPD** — Portuguese GDPR. Citizens must accept RGPD terms at registration (`rgpd_accepted`).
- **Soft-delete** — records are marked with `eliminado_em` timestamp instead of being physically deleted.
- **CidadaoPerfil** — the citizen profile extension table (`cidadao_perfis`), linked 1:1 to `users`.
- **Contracts** — shared TypeScript interfaces in `packages/contracts/` defining API request/response shapes.

## Naming Conventions

- Database columns: snake_case (`cidadao_id`, `ecoponto_id`, `zona_id`).
- Prisma models: PascalCase (`CidadaoPerfil`, `User`).
- API paths: plural resource names, Portuguese where domain-specific (`/cidadaos`, `/ecopontos`, `/zonas`, `/reports`).
- Timestamps: `criado_em`, `atualizado_em`, `eliminado_em`.
