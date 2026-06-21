# EcoBairro

EcoBairro e uma plataforma focada na descoberta de ecopontos, reports, visibilidade de telemetria e suporte operacional para fluxos de trabalho ligados a residuos.

## Estado Da Fundacao

O repositorio inclui atualmente:

- uma app frontend em `apps/web`
- uma app backend principal em `apps/api`
- um servico de analytics em `apps/analytics`
- pacotes TypeScript partilhados em `packages/`
- orquestracao Docker Compose em `infra/compose`
- encaminhamento Nginx por prefixos em `infra/nginx`
- PostgreSQL + PostGIS e Redis na stack base
- uma fatia funcional da Fase 1 no backend para autenticacao de cidadao e gestao do proprio perfil

## Pre-Requisitos

- Docker Desktop ou um daemon Docker local
- Node.js com `pnpm` ativo via Corepack

## Comandos Locais

- `pnpm install --no-frozen-lockfile`: instala ou atualiza todas as dependencias do workspace a partir da raiz do repositorio.
- `pnpm lint`: executa validacoes de lint para os pacotes partilhados e para as apps JS/TS.
- `pnpm typecheck`: executa verificacoes TypeScript para os pacotes partilhados e para as apps JS/TS.
- `pnpm compose:config`: mostra a configuracao final do Docker Compose para confirmar variaveis e ligacoes entre servicos.
- `pnpm compose:up`: constroi imagens se necessario e arranca toda a stack local em modo detached.
- `pnpm compose:down`: para e remove os contentores e redes da stack local.
- `pnpm compose:logs`: segue os logs combinados de toda a stack.
- `pnpm compose:logs:web`: segue apenas os logs do contentor frontend.
- `pnpm compose:logs:api`: segue apenas os logs do contentor NestJS API.
- `pnpm compose:logs:analytics`: segue apenas os logs do contentor FastAPI analytics.
- `pnpm compose:logs:db`: segue os logs dos servicos de infra como PostgreSQL, Redis e Nginx.
- `pnpm compose:ps`: mostra o estado atual dos contentores da stack.
- `pnpm compose:restart`: recria a stack local com um ciclo completo de down/up em modo detached.
- `pnpm --filter @ecobairro/web test`: corre a baseline de testes do scaffold frontend.
- `pnpm --dir apps/api test`: corre a cobertura unit test atual da API.

## Setup Local

1. Garante que o Docker Desktop ou o teu daemon Docker local esta a correr.
2. Copia `.env.example` para `.env` se precisares de alterar valores locais por omissao.
3. Executa `pnpm compose:up`.
4. Aplica as migrations do backend:

```powershell
pnpm --dir apps/api exec prisma migrate deploy
```

5. Executa `pnpm compose:ps` se quiseres confirmar rapidamente o estado da stack.
6. Abre `http://localhost:8080/`.

## Fluxo De Trabalho No Terminal

Fluxo local recomendado:

- mantem `pnpm compose:up` em modo detached para a shell principal continuar livre
- usa `pnpm compose:logs` apenas quando quiseres ver o stream combinado
- prefere logs direcionados como `pnpm compose:logs:api` ou `pnpm compose:logs:web` quando estiveres a trabalhar numa area especifica
- usa `pnpm compose:ps` para uma verificacao rapida do estado dos contentores

## Estado Atual Das Apps

- `apps/web`: frontend TanStack Start preparado com grupos de rotas placeholder
- `apps/api`: runtime NestJS com health/readiness e endpoints da Fase 1 para autenticacao e perfil proprio do cidadao
- `apps/analytics`: FastAPI preparado com health e readiness

## Notas Sobre O Scaffold Frontend

- `apps/web/src/routes` e a unica superficie de autoria de rotas.
- `apps/web/src/components/layout` guarda as shells da app e das areas.
- `apps/web/src/components/ui` guarda primitivos UI neutros e boundaries partilhadas.
- `apps/web/src/routeTree.gen.ts` e gerado pelo TanStack Router e nao deve ser editado manualmente.
- As rotas placeholder em `/`, `/app` e `/admin` sao apenas scaffolding e destinam-se a ser substituidas pelas equipas de funcionalidade.

## Estado Atual Da Infra

- stack base Docker Compose preparada para `web`, `api`, `analytics`, `postgres` e `redis`
- script de inicializacao PostGIS adicionado para a base de dados local
- Nginx encaminha todo o trafego local atraves de um unico ponto de entrada em `http://localhost:8080`

## Superficies De Health

- `web`: pagina placeholder no browser
- `api`: `/health` e `/ready`
- `analytics`: `/health` e `/ready`

## Endpoints Locais

- `http://localhost:8080/`
- `http://localhost:8080/api/health`
- `http://localhost:8080/api/ready`
- `http://localhost:8080/api/v1/auth/register`
- `http://localhost:8080/api/v1/auth/login`
- `http://localhost:8080/api/v1/auth/refresh`
- `http://localhost:8080/api/v1/auth/logout`
- `http://localhost:8080/api/v1/cidadaos/me`
- `http://localhost:8080/analytics/health`
- `http://localhost:8080/analytics/ready`

## Documentacao

- `docs/05-local-runtime-bootstrap.md`: guia de setup e verificacao do runtime local para a equipa
- `docs/06-frontend-scaffold.md`: decisoes do stack frontend, estrutura de diretorios, modelo de routing e regras de extensao
- `docs/07-web-implementation-playbook.md`: guia passo a passo para implementar trabalho dentro do scaffold atual de `apps/web`
- `docs/08-api-implementation-playbook.md`: estado atual da implementacao backend, ownership de ficheiros e como adicionar novas funcionalidades da API
- `docs/models/`: documentos de planeamento de dominio e modelos de dados

## Estrutura Do Repositorio

```text
apps/
packages/
docs/
infra/
```
