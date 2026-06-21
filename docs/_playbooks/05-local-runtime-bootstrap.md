# Bootstrap Do Runtime Local

Este guia documenta o runtime local que existe hoje no repositorio.

Foi escrito para colegas que precisam de:

- levantar o projeto pela primeira vez
- perceber o que a stack Docker esta a fazer
- ligar-se ao contentor PostgreSQL local
- aplicar migrations Prisma
- fazer troubleshooting da stack backend da Fase 1

## Visao Geral Do Runtime Atual

A stack local e orquestrada com Docker Compose em:

`infra/compose/docker-compose.yml`

Os servicos atualmente presentes na stack sao:

- `web`: app frontend
- `api`: backend NestJS
- `analytics`: servico FastAPI analytics
- `postgres`: PostgreSQL 16 com PostGIS
- `redis`: Redis 7
- `nginx`: ponto de entrada local unico que encaminha o trafego para os servicos internos

Todo o trafego local passa por:

`http://localhost:8080`

## Pre-Requisitos

- Docker Desktop ou um daemon Docker local funcional
- Node.js
- `pnpm` ativo via Corepack

Recomendado a partir da raiz do repositorio:

```powershell
pnpm install --no-frozen-lockfile
```

## Primeiro Arranque

A partir da raiz do repositorio:

```powershell
pnpm compose:up
pnpm compose:ps
```

O que isto faz:

- constroi os contentores das apps, se necessario
- arranca PostgreSQL, Redis, web, api, analytics e nginx
- monta o repositorio nos contentores JS para desenvolvimento
- instala automaticamente as dependencias do workspace dentro dos contentores quando necessario
- gera automaticamente o Prisma Client para `@ecobairro/api` no arranque da API

Quando a stack estiver saudavel, abre:

- `http://localhost:8080/`
- `http://localhost:8080/api/health`
- `http://localhost:8080/api/ready`
- `http://localhost:8080/analytics/health`
- `http://localhost:8080/analytics/ready`

## Comandos Locais Uteis

Usa estes comandos a partir da raiz do repositorio:

```powershell
pnpm compose:up
pnpm compose:down
pnpm compose:restart
pnpm compose:ps
pnpm compose:logs
pnpm compose:logs:api
pnpm compose:logs:db
```

Fluxo recomendado:

- mantem a stack a correr em modo detached com `pnpm compose:up`
- usa `pnpm compose:ps` para confirmar rapidamente o estado
- usa `pnpm compose:logs:api` quando estiveres a depurar backend
- usa `pnpm compose:logs:db` quando estiveres a depurar PostgreSQL, Redis ou nginx

## Contentor PostgreSQL

O servico de base de dados e:

- image: `postgis/postgis:16-3.4`
- nome do servico dentro do Compose: `postgres`
- porto no host: `localhost:5432`
- base de dados por omissao: `ecobairro`
- utilizador por omissao: `ecobairro`
- password por omissao: `ecobairro`

Estes valores vem de `.env.example`, exceto se forem substituidos no teu `.env` local.

String de ligacao por omissao a partir do host:

```text
postgresql://ecobairro:ecobairro@localhost:5432/ecobairro
```

String de ligacao interna usada pelo contentor da API:

```text
postgresql://ecobairro:ecobairro@postgres:5432/ecobairro
```

### Persistencia de dados

Os dados de PostgreSQL sao guardados no volume Docker nomeado:

`postgres-data`

Isto significa:

- `pnpm compose:down` para os contentores, mas mantem os dados da BD
- ao arrancar novamente a stack, a mesma base de dados volta a ser reutilizada

### Inicializacao do PostGIS

Na primeira inicializacao do contentor, o seguinte ficheiro SQL e montado no init do PostgreSQL:

`infra/postgres/init/001-enable-postgis.sql`

Conteudo atual:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Isto corre apenas quando o PostgreSQL inicializa um diretoria de dados novo.

## Prisma E Migrations

A API usa Prisma 7.

Ficheiros importantes:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma.config.ts`
- `apps/api/prisma/migrations/`

### Como o Prisma obtem a database URL

O schema Prisma nao define a datasource URL inline.
Em vez disso, o Prisma le-a a partir de:

`apps/api/prisma.config.ts`

Essa configuracao tenta, por esta ordem:

1. `.env` na raiz
2. `apps/api/.env`
3. valores fallback baseados em `localhost:5432`

E por isso que os comandos Prisma CLI executados no host continuam a conseguir ligar-se ao contentor local de Postgres.

### Aplicar migrations localmente

Depois de a stack estar levantada, aplica as migrations a partir da raiz do repositorio:

```powershell
pnpm --dir apps/api exec prisma migrate deploy
```

Para criacao de migrations apenas em desenvolvimento:

```powershell
pnpm --dir apps/api exec prisma migrate dev --name your_migration_name
```

Regenera o Prisma Client, se necessario:

```powershell
pnpm --dir apps/api prisma:generate
```

### Estado atual das migrations

A primeira migration backend efetivamente implementada e:

`apps/api/prisma/migrations/20260418230000_init_auth_phase1/migration.sql`

Ela cria:

- `users`
- `cidadao_perfis`
- enum `UserRole`
- indices para role, email, relacao com o perfil de cidadao e pesquisa por soft-delete

## Contentor Redis

O servico Redis local e:

- image: `redis:7-alpine`
- acesso a partir dos contentores: `redis://redis:6379/0`

O backend atual da Fase 1 usa Redis para armazenamento de sessoes de autenticacao.

Padrao atual de chaves Redis:

- `user:session:{user_id}`

## Modelo De Routing

Externamente, o nginx expoe:

- web em `/`
- api em `/api/...`
- analytics em `/analytics/...`

A app Nest usa o prefixo global:

`/v1`

Por isso, as rotas de negocio backend estao expostas externamente em:

`/api/v1/...`

Exemplos:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/cidadaos/me`

Os endpoints de health ficam fora do prefixo de versao da API:

- `/api/health`
- `/api/ready`

## Estado Atual Do Backend

O backend ja esta para alem da fase de scaffold.

Funcionalidades backend da Fase 1 ja implementadas:

- modelo de dados Prisma para users e perfis de cidadao
- sessoes de autenticacao em Redis
- autenticacao JWT bearer
- autorregisto de cidadao
- login, refresh e logout
- leitura e atualizacao do proprio perfil de cidadao
- cobertura unit test para auth service, JWT guard e citizen profile service

## Smoke Test Manual Da API

Usa esta base URL:

```text
http://localhost:8080/api/v1
```

Exemplo de registo:

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "test1@example.com",
  "password": "Password123!",
  "phone": "+351910000000",
  "rgpd_accepted": true
}
```

Exemplo de login:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "test1@example.com",
  "password": "Password123!"
}
```

Exemplo de pedido autenticado ao perfil:

```http
GET /api/v1/cidadaos/me
Authorization: Bearer <access_token>
```

## Executar Verificacoes

Verificacoes da API:

```powershell
pnpm --dir apps/api test
pnpm --dir apps/api typecheck
pnpm --dir apps/api lint
```

Verificacoes do workspace:

```powershell
pnpm typecheck
pnpm lint
```

## Troubleshooting

### `api` esta unhealthy

Verifica:

```powershell
pnpm compose:logs:api
pnpm compose:ps
```

Causas comuns:

- Postgres ainda nao esta healthy
- Redis ainda nao esta healthy
- variaveis de ambiente em falta ou invalidas
- as migrations ainda nao foram aplicadas

### Os comandos Prisma nao conseguem ligar-se a base de dados

Verifica:

- o Docker esta a correr
- `postgres` esta healthy em `pnpm compose:ps`
- o teu `DATABASE_URL` local aponta para `localhost:5432`, e nao para `postgres:5432`

URL recomendada no host:

```text
postgresql://ecobairro:ecobairro@localhost:5432/ecobairro
```

### Preciso de inspecionar manualmente a base de dados

Usa qualquer cliente PostgreSQL com:

- host: `localhost`
- port: `5432`
- database: `ecobairro`
- user: `ecobairro`
- password: `ecobairro`

### Preciso de uma base de dados local limpa

Cuidado: remover volumes do Compose destrui dados locais.

Se quiseres intencionalmente uma base de dados limpa:

```powershell
docker compose -f infra/compose/docker-compose.yml down -v
pnpm compose:up
pnpm --dir apps/api exec prisma migrate deploy
```

## Restricao Importante Neste Momento

O fluxo de desenvolvimento backend preferencial neste momento e Docker-first.

O contentor da API ja recebe do Compose as variaveis de ambiente de runtime de que precisa.
Executar `apps/api` diretamente na maquina host e possivel, mas ainda nao e o fluxo de equipa mais padronizado, porque nesse caso tens de fornecer tu proprio as variaveis de ambiente de runtime.
