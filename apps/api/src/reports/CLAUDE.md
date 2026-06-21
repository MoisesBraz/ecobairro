# REPORTS module (`/api/v1/reports`)

## Estrutura do diretório

```text
src/reports/
  reports.module.ts
  reports.controller.ts
  reports.service.ts
  dto/
    create-report.dto.ts
    list-reports.dto.ts
    report-stats.dto.ts
    update-report-status.dto.ts

tests/reports/
  reports.service.test.ts
```

> Convenção: todos os testes vivem em `apps/api/tests/<modulo>/`, espelhando
> a estrutura de `src/`. Correm via `pnpm --filter @ecobairro/api test`.

## O que foi realizado

- Endpoint `POST /reports` implementado.
- Endpoint `GET /reports/me` implementado.
- Endpoint `GET /reports` implementado.
- Endpoint `PATCH /reports/:id/status` implementado.
- RBAC aplicado:
  - `CIDADAO`: cria e lista próprios.
  - `OPERADOR`/`GESTOR`/`ADMIN`: lista global e atualiza status.
- Integração com tabela `reports` no PostgreSQL.
- Testes de service para permissões, filtros e mudança de status.

- **Georreferenciação opcional (R2/R8):** `POST /reports` aceita `lat`/`lng` (ambas ou
  nenhuma; validadas no DTO). Persistidas em `reports.lat/lng`; a coluna PostGIS
  `reports.geom` (gerada de lng/lat, migração `20260620130000_reports_geo`) é consumida
  pelo serviço FastAPI em `GET /reports/proximos` e `GET /reports/duplicados`
  (`apps/analytics/`). O NestJS **não** corre queries geo — só escreve as coords.

## O que falta realizar

- ~~Frontend de criação a enviar lat/lng (picker de mapa)~~ **feito**: o formulário
  (`apps/web/src/routes/_layoutmain.reportes.tsx` + `components/reportes/location-picker.tsx`)
  tem mapa + pesquisa de morada (Nominatim) + geolocalização, e avisa de duplicados (R8)
  antes de submeter. `lat/lng` continuam opcionais (o cidadão pode submeter sem mapa).
- Timeline/histórico de status (`ReportTimeline`) se entrar na próxima fase.
- Regras de deduplicação no fluxo de criação (hoje `duplicados` é consulta separada, não bloqueia).
- Upload/storage real de imagem (hoje guarda URL/string no campo `imagem`).
- Métricas operacionais e auditoria por alteração de status.

## O que não fazer

- Não mover checks de role para controller apenas; manter no service.
- Não enviar strings de paginação para Prisma sem normalização.
- Não alterar enum/status sem atualizar Prisma + contracts + DTO + testes.
- Não permitir `PATCH /reports/:id/status` para perfis fora de `OPERADOR`/`GESTOR` e `ADMIN`.

## Linkagens para módulos utilizados

- `../auth` (guard JWT e utilizador autenticado)
- `../database` (Prisma)
- `../../prisma/schema.prisma` (modelo `Report`)
- `../../../../packages/contracts/src/index.ts` (tipos de reports)
- `../../../../docs/08-api-implementation-playbook.md` (estado/guia API)
