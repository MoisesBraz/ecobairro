# Guia De Implementacao Da API

Este documento explica o que esta atualmente implementado em `apps/api`, como esta estruturado, e como adicionar novas funcionalidades backend sem andar a adivinhar.

Foi pensado para ajudar a equipa a responder rapidamente a tres perguntas:

- o que ja existe
- onde deve entrar trabalho novo no backend
- qual e o padrao de implementacao esperado

## Ambito Atual

O backend implementa atualmente a primeira fatia utilizavel da Fase 1:

- registo de cidadao
- login
- rotacao de refresh token
- logout
- leitura do proprio perfil de cidadao
- atualizacao do proprio perfil de cidadao
- criacao de report por cidadao
- listagem de reports do proprio cidadao
- listagem operacional de reports com filtros
- atualizacao de estado de report para gestor/admin
- readiness checks para PostgreSQL e Redis

Ainda nao implementado:

- verificacao de email
- forgot/reset password
- 2FA
- fluxos de gestor/admin
- fluxos de dados sensiveis
- workers BullMQ
- audit logging
- cache para alem das auth sessions

## Runtime E Routing

A app backend e:

`apps/api`

Porto interno do runtime Nest:

`3000`

Base externa das rotas atraves do nginx:

`/api/v1`

As rotas de health ficam fora do prefixo global de versao da API:

- `/api/health`
- `/api/ready`

As rotas de negocio vivem atualmente em:

- `/api/v1/auth/...`
- `/api/v1/cidadaos/...`
- `/api/v1/reports/...`

## Estrutura De Modulos

Estrutura atual de `apps/api/src`:

```text
src/
  app.module.ts
  main.ts
  health.controller.ts
  health.service.ts
  auth/
  cidadaos/
  reports/
  database/
  redis/
  test/
```

### O que cada area detem

- `auth/`
  - endpoints publicos de autenticacao
  - logica de negocio para login/register/refresh/logout
  - JWT guard
  - extracao do utilizador atual
  - validacao dos DTOs de autenticacao
- `cidadaos/`
  - rotas do proprio perfil de cidadao
  - regras de negocio especificas do cidadao para `/me`
- `reports/`
  - rotas de criacao/listagem/atualizacao de status de reports
  - regras de role para cidadao e perfis operacionais
- `database/`
  - provider global do Prisma
- `redis/`
  - provider global do Redis
- `health.*`
  - liveness e readiness checks

## Camada De Dados

### Prisma

O Prisma e a camada atual de leitura/escrita para as funcionalidades backend implementadas.

Ficheiros importantes:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/`
- `apps/api/prisma.config.ts`

Modelos atualmente implementados:

- `User`
- `CidadaoPerfil`
- enum `UserRole`
- `Report`
- enum `ReportStatus`

### Tabelas atuais

#### `users`

Objetivo:

- identidade
- credenciais de autenticacao
- role
- estado de soft-delete

Colunas implementadas:

- `id`
- `email`
- `password_hash`
- `phone`
- `email_verified`
- `role`
- `criado_em`
- `atualizado_em`
- `eliminado_em`

#### `cidadao_perfis`

Objetivo:

- extensao do perfil especifico de cidadao sobre `users`

Colunas implementadas:

- `id`
- `user_id`
- `nome_completo`
- `gamification_opt_in`
- `notificacao_prefs`
- `dashboard_widgets`
- `rgpd_accepted`
- `criado_em`
- `atualizado_em`

#### `reports`

Objetivo:

- guardar reports de ocorrencias submetidos por utilizadores
- suportar triagem operacional por status

Colunas implementadas:

- `id`
- `titulo`
- `tipo`
- `descricao`
- `local`
- `imagem_url`
- `status`
- `user_id`
- `criado_em`
- `atualizado_em`

### Migration atual

Migrations implementadas:

`apps/api/prisma/migrations/20260418230000_init_auth_phase1/migration.sql`
`apps/api/prisma/migrations/20260425095000_add_reports_phase1/migration.sql`

Comportamentos de base de dados importantes ja presentes:

- indice unico em `users.email`
- indice em `users.role`
- indice parcial em `users.eliminado_em`
- relacao one-to-one de `cidadao_perfis.user_id` para `users.id`
- indice em `reports.status`
- indice em `reports.criado_em`
- indice em `reports.user_id`
- relacao many-to-one de `reports.user_id` para `users.id`

## Contratos Partilhados

As estruturas de request e response entre apps vivem em:

`packages/contracts/src/index.ts`

Esta e a superficie contract-first para alinhamento entre backend e frontend.

Os contratos atualmente implementados incluem:

- `RegisterRequest`
- `RegisterResponse`
- `LoginRequest`
- `LoginResponse`
- `RefreshRequest`
- `CitizenSelfProfileResponse`
- `UpdateCitizenSelfProfileRequest`
- `ReportStatus`
- `ReportTipo`
- `ReportRecord`
- `CreateReportRequest`
- `CreateReportResponse`
- `ListReportsQuery`
- `ListReportsResponse`
- `UpdateReportStatusRequest`
- `UpdateReportStatusResponse`

## Implementacao De Reports

### Criar report (cidadao)

Rota:

`POST /api/v1/reports`

Comportamento:

- requer autenticacao JWT
- exige role `CIDADAO`
- cria report com status inicial `pendente`

### Listar reports proprios (cidadao)

Rota:

`GET /api/v1/reports/me`

Comportamento:

- requer autenticacao JWT
- exige role `CIDADAO`
- devolve apenas reports do utilizador autenticado
- suporta filtros e paginacao (`status`, `tipo`, `q`, `page`, `pageSize`)

### Listar reports operacionais

Rota:

`GET /api/v1/reports`

Comportamento:

- requer autenticacao JWT
- permite perfis `GESTOR`, `ADMIN`
- devolve reports globais com filtros e paginacao

### Atualizar status de report

Rota:

`PATCH /api/v1/reports/:id/status`

Comportamento:

- requer autenticacao JWT
- permite apenas `GESTOR` e `ADMIN`
- atualiza status entre `pendente`, `analise`, `resolvido`, `rejeitado`

Regra pratica:

- se o request body ou response body da API faz parte do contrato do produto, define-o ou atualiza-o primeiro em `packages/contracts`

## Implementacao Da Autenticacao

### Fluxo de registo

Rota:

`POST /api/v1/auth/register`

Comportamento:

1. normaliza o email para lowercase
2. verifica se ja existe utilizador com esse email
3. faz hash da password com bcrypt
4. cria `users` e `cidadao_perfis` numa unica transacao Prisma
5. força `role = CIDADAO`

Restricoes atuais:

- o autorregisto e apenas para cidadaos
- `rgpd_accepted` tem de ser `true`
- ainda nao existe fluxo de verificacao de email

### Fluxo de login

Rota:

`POST /api/v1/auth/login`

Comportamento:

1. normaliza o email
2. carrega o utilizador pelo email
3. rejeita utilizadores inexistentes ou soft-deleted
4. verifica a password com bcrypt
5. emite access token JWT
6. emite refresh token opaco
7. guarda a sessao ativa de refresh em Redis

### Fluxo de refresh

Rota:

`POST /api/v1/auth/refresh`

Comportamento:

1. extrai o user id a partir do refresh token opaco
2. carrega a sessao ativa em Redis
3. compara o hash do token guardado
4. confirma que o utilizador ainda existe e nao esta soft-deleted
5. roda o refresh token sobrescrevendo a sessao em Redis

### Fluxo de logout

Rota:

`POST /api/v1/auth/logout`

Comportamento:

- requer autenticacao JWT
- apaga a chave de sessao ativa do utilizador em Redis

### JWT payload

Payload atual:

```json
{
  "sub": "<user_id>",
  "role": "CIDADAO"
}
```

### Modelo de sessao em Redis

Chave atual:

`user:session:{user_id}`

Politica v1 atual:

- uma refresh session ativa por utilizador
- um novo login substitui a refresh session antiga

## Implementacao Do Perfil De Cidadao

### Ler o proprio perfil

Rota:

`GET /api/v1/cidadaos/me`

Comportamento:

- requer autenticacao JWT
- requer role `CIDADAO`
- junta identidade do utilizador com perfil de cidadao
- devolve apenas os campos permitidos e nao sensiveis

### Atualizar o proprio perfil

Rota:

`PUT /api/v1/cidadaos/me`

Campos atualmente permitidos:

- `phone`
- `nome_completo`
- `gamification_opt_in`
- `notificacao_prefs`
- `dashboard_widgets`

Regra atual:

- apenas cidadaos podem usar estes endpoints

## Validacao E Guards

### Validacao global

Configurada em `main.ts`:

- whitelist ativa
- forbid non-whitelisted properties ativo
- transform ativo

Significado pratico:

- os DTOs sao o contrato do request
- campos extra no body sao rejeitados

### Guard de autenticacao atual

Ficheiro:

`apps/api/src/auth/jwt-auth.guard.ts`

Comportamento:

- le `Authorization: Bearer <token>`
- verifica o JWT
- anexa `request.authUser = { userId, role }`

### Decorator do utilizador atual

Ficheiro:

`apps/api/src/auth/current-user.decorator.ts`

Objetivo:

- permitir que os controllers leiam o utilizador autenticado de forma limpa

## Tratamento De Erros

Todas as respostas de erro passam por um **filtro global**
(`apps/api/src/common/errors/http-exception.filter.ts`, registado em `main.ts`)
que devolve sempre o contrato `ApiErrorResponse` (`{ statusCode, code, message, details? }`).
Garante mensagens pt-PT amigáveis, um `code` estável e que **nunca** se expõe
stack/Prisma/texto interno (5xx → mensagem genérica + log).

Para lançar erros usa os helpers em `apps/api/src/common/errors/` em vez de
`new XException('texto')`:

```ts
import { forbidden, notFound, conflict } from '../common/errors';

if (role !== 'CIDADAO') throw forbidden();             // 403, 'FORBIDDEN'
if (!report) throw notFound('REPORT_NOT_FOUND');       // 404
throw conflict('AUTH_EMAIL_TAKEN');                    // 409
```

As mensagens vivem em `error-catalog.ts` (fonte de verdade) e os códigos em
`packages/contracts/src/errors.ts`. Detalhe completo (incl. uso no frontend) em
[docs/_playbooks/09-error-handling.md](09-error-handling.md).

## Health E Readiness

Rotas atuais:

- `GET /health`
- `GET /ready`

Readiness checks implementados:

- conectividade PostgreSQL
- conectividade Redis

Isto e util quando estas a depurar a ordem de arranque dos contentores.

## Testes

A abordagem atual aos testes da API e intencionalmente leve.

Ficheiros de teste:

- `apps/api/src/auth/auth.service.test.ts`
- `apps/api/src/auth/jwt-auth.guard.test.ts`
- `apps/api/src/cidadaos/cidadaos.service.test.ts`
- `apps/api/src/reports/reports.service.test.ts`
- `apps/api/src/test/run-tests.ts`

Corre-os com:

```powershell
pnpm --dir apps/api test
```

Os testes atuais cobrem:

- registo em auth
- rejeicao de registo duplicado
- criacao de sessao no login
- rotacao do refresh token
- invalidacao no logout
- caminhos de sucesso e falha do JWT guard
- leitura e atualizacao do proprio perfil de cidadao
- criacao de reports
- listagem por escopo (cidadao vs operacional)
- controlo de permissao por role na atualizacao de status

## Como Implementar Uma Nova Funcionalidade Backend

Usa esta sequencia para trabalho novo no backend.

### 1. Definir primeiro o ambito

Antes de escrever codigo, decide:

- e um modulo novo ou uma extensao de um modulo existente
- precisa de novas tabelas ou colunas na base de dados
- altera contratos de request/response
- precisa de autenticacao ou restricoes por role
- precisa de Redis, async jobs, ou apenas de PostgreSQL

### 2. Atualizar contratos partilhados se a forma da API mudar

Ficheiro:

`packages/contracts/src/index.ts`

Adiciona ou atualiza:

- request interfaces
- response interfaces
- enums ou literal types partilhados, se necessario

### 3. Adicionar DTOs no modulo responsavel

Exemplos:

- `apps/api/src/auth/dto/register.dto.ts`
- `apps/api/src/cidadaos/dto/update-cidadao-profile.dto.ts`

Orientacao:

- os contratos descrevem a forma externa da API
- os DTOs aplicam a validacao runtime no Nest

### 4. Atualizar Prisma quando a persistencia mudar

Ficheiros:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/...`

Processo:

1. atualiza o schema Prisma
2. gera uma migration
3. inspeciona o SQL gerado
4. ajusta manualmente a migration se precisares de comportamento especifico de PostgreSQL
5. aplica a migration localmente

Comandos de exemplo:

```powershell
pnpm --dir apps/api exec prisma migrate dev --name add_feature_name
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api prisma:generate
```

Usa edicoes manuais na migration SQL para o que o Prisma nao modela bem, como:

- extensoes
- indices parciais
- funcionalidades avancadas de PostgreSQL

### 5. Adicionar ou estender o modulo

Padrao tipico de ficheiros:

```text
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/
```

Orientacao:

- o controller detem as preocupacoes HTTP
- o service detem a logica de negocio
- Prisma e Redis ficam por tras dos limites do service

### 6. Registar o modulo

Importa o modulo em:

`apps/api/src/app.module.ts`

a menos que a funcionalidade esteja intencionalmente aninhada noutra estrutura de modulo.

### 7. Aplicar explicitamente auth e regras de role

Usa:

- `@UseGuards(JwtAuthGuard)` para rotas autenticadas
- `@CurrentUser()` para aceder ao utilizador atual
- verificacoes explicitas de role no service quando a logica for sensivel a role

Padrao atual para comportamento citizen-only:

- o guard autentica o utilizador
- o service aplica a restricao de role

### 8. Adicionar testes

Para logica de service:

- adiciona cobertura unit focada perto do modulo

Para funcionalidades ao nivel da rota:

- adiciona primeiro testes ao nivel do service
- adiciona testes de nivel superior mais tarde se o standard do projeto evoluir

### 9. Atualizar a documentacao

No minimo atualiza:

- a documentacao para a equipa se o setup/runtime mudou
- o playbook backend se a arquitetura ou os padroes mudaram
- os docs de dominio se novos endpoints ou comportamento de dados se tornaram reais

## Exemplo: Adicionar Um Novo Endpoint Backend Protegido

Exemplo de objetivo:

`GET /api/v1/cidadaos/me/preferences`

Passos sugeridos:

1. adicionar shared response type em `packages/contracts`
2. adicionar um DTO apenas se for necessaria validacao de query/body
3. adicionar um metodo de service em `CidadaosService`
4. adicionar uma rota no controller em `CidadaosController`
5. reutilizar `JwtAuthGuard`
6. aplicar acesso apenas a cidadao no service
7. adicionar testes junto ao modulo
8. documentar a nova rota

## Exemplo: Adicionar Uma Nova Tabela

Exemplo de objetivo:

`cidadao_favoritos`

Passos sugeridos:

1. adicionar o modelo Prisma
2. criar a migration
3. inspecionar manualmente indices e foreign keys em SQL
4. regenerar Prisma client
5. criar um modulo Nest ou estender `cidadaos/` se a ownership continuar a ser do perfil de cidadao
6. adicionar contratos e DTOs
7. implementar controller + service
8. adicionar testes
9. atualizar a documentacao

## Notas Praticas Para A Equipa

- prefere comandos a partir da raiz do repositorio no dia a dia
- prefere runtime local Docker-first
- trata `packages/contracts` como a verdade da API para request/response shape
- mantem a logica de negocio nos services, nao nos controllers
- atualiza a documentacao como parte da funcionalidade, nao depois

## Gaps Atuais A Ter Em Conta

Estas areas continuam reservadas para fases futuras:

- fluxo de verificacao de email
- forgot/reset password
- 2FA
- fluxos de perfil de gestor/admin
- encriptacao de PII e endpoints de dados sensiveis
- audit logging
- async jobs e workers
- estrategia de cache mais ampla

Este playbook deve ser atualizado sempre que alguma destas areas passar de planeada a implementada.
