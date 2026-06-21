# Contribuicao

## Objetivo

Este documento define o fluxo de trabalho base, as expectativas de qualidade e as regras de colaboracao deste repositorio.

O objetivo e manter o projeto consistente, revisavel e seguro de evoluir.

---

## Fluxo De Trabalho Do Repositorio

- `main` e a branch protegida
- ninguem faz push diretamente para `main`
- todas as alteracoes passam por pull requests
- os pull requests sao integrados com **Squash**
- as feature branches devem ser de curta duracao

### Nome das branches

Usa um dos seguintes prefixos:

- `feat/` para novas funcionalidades
- `fix/` para correcao de bugs
- `docs/` para documentacao
- `refactor/` para reestruturacao interna
- `test/` para trabalho relacionado com testes
- `chore/` para manutencao e tooling

### Exemplos

- `feat/report-submission`
- `fix/map-filter-state`
- `docs/domain-map`
- `chore/ci-setup`

---

## Pull Requests

### Antes de abrir um PR

Garante que a tua branch:

- esta atualizada com `main`
- compila com sucesso
- passa os testes relevantes
- nao inclui alteracoes nao relacionadas

### Regras dos PR

- todas as alteracoes devem ser submetidas por pull request
- e necessaria pelo menos **1 aprovacao**
- todas as conversas de review devem estar resolvidas
- aprovacoes antigas sao invalidadas automaticamente quando entram novos commits
- e necessaria review de code owner quando aplicavel

### Estilo do titulo do PR

Usa um titulo curto e descritivo, porque vai tornar-se na mensagem do squash commit.

Exemplos:

- `feat(api): add report submission flow`
- `fix(web): correct map filter reset`
- `docs(architecture): define domain ownership`

### A descricao do PR deve incluir

- o que mudou
- porque mudou
- notas importantes de implementacao
- screenshots se a UI mudou
- limitacoes conhecidas ou follow-ups

---

## Regras Para Commits

Prefere commits pequenos e focados.

Formato recomendado:

- `feat: add telemetry ingestion endpoint`
- `fix: prevent duplicate report submission`
- `docs: add system scope and goals`
- `refactor: isolate report validation service`

Nao mistures preocupacoes nao relacionadas no mesmo commit.

---

## Desenvolvimento Local

### Setup inicial

Antes de trabalhar no projeto localmente:

- garante que o Docker Desktop ou o teu daemon Docker local esta a correr
- instala as dependencias do workspace com `pnpm install --no-frozen-lockfile`
- consulta as notas do runtime local em `README.md` e `docs/05-local-runtime-bootstrap.md`

### Fluxo de trabalho do developer

Trata a raiz do repositorio como ponto de entrada por omissao para os comandos.

Importante:

- executa os comandos `pnpm` a partir da raiz do repositorio
- executa os comandos Docker Compose a partir da raiz do repositorio
- mantem um unico lockfile na raiz: `pnpm-lock.yaml`
- nao executes `pnpm install` dentro de `apps/*` ou `packages/*`
- nao cries lockfiles por app
- nao uses `npm install` dentro dos packages do workspace

Quando estiveres a trabalhar numa app ou package especifico, continua a partir da raiz e usa filtros:

- `pnpm --filter @ecobairro/web dev`
- `pnpm --filter @ecobairro/web test`
- `pnpm --filter @ecobairro/api dev`
- `pnpm --filter @ecobairro/contracts typecheck`

### Comandos comuns

Usa os scripts de raiz sempre que possivel:

- `pnpm lint`: executa verificacoes de lint para os packages partilhados e apps JS/TS.
- `pnpm typecheck`: executa verificacoes TypeScript para os packages partilhados e apps JS/TS.
- `pnpm compose:config`: inspeciona a configuracao final do Docker Compose.
- `pnpm compose:up`: constroi e arranca o runtime local em modo detached.
- `pnpm compose:down`: para e remove os contentores do runtime local.
- `pnpm compose:logs`: segue os logs combinados de toda a stack.
- `pnpm compose:logs:web`: segue apenas os logs do frontend.
- `pnpm compose:logs:api`: segue apenas os logs da API.
- `pnpm compose:logs:analytics`: segue apenas os logs do analytics.
- `pnpm compose:logs:db`: segue os logs de PostgreSQL, Redis e Nginx.
- `pnpm compose:ps`: inspeciona o estado atual e health dos contentores.
- `pnpm compose:restart`: recria o runtime local com um ciclo completo de down/up.

Usa arranque detached e logs direcionados por omissao:

- prefere `pnpm compose:up` em vez de `docker compose up` em foreground
- usa `pnpm compose:logs:api` ou `pnpm compose:logs:web` enquanto trabalhas numa area especifica
- usa `pnpm compose:logs` apenas quando quiseres o stream combinado completo

### Expectativa de runtime nesta fase

A fundacao atual do repositorio e considerada saudavel quando:

- `web` esta acessivel em `http://localhost:8080/`
- `api` responde em `/api/health` e `/api/ready`
- `analytics` responde em `/analytics/health` e `/analytics/ready`
- PostgreSQL e Redis estao saudaveis no Docker Compose

---

## Expectativas De Codigo

### Geral

- mantem o codigo simples e legivel
- prefere nomes explicitos a solucoes demasiado espertas
- evita pull requests grandes e pouco revisaveis
- mantem a logica de negocio perto do modulo que a detem

### Codigo partilhado

- coloca codigo em packages partilhados apenas quando for realmente partilhado
- nao movas logica de dominio para packages partilhados sem necessidade

### Documentacao

Atualiza a documentacao quando alterares:

- arquitetura
- fluxo de setup local
- comandos de developer
- responsabilidades dos servicos
- workflows principais
- contratos partilhados
- estrutura do repositorio

Se uma alteracao afetar significativamente a arquitetura, adiciona ou atualiza uma ADR.

### Convencoes do scaffold frontend

- trata `apps/web/src/routes` como a unica superficie de autoria de rotas
- mantem o enquadramento da app e das areas em `apps/web/src/components/layout`
- mantem UI partilhada e neutra em `apps/web/src/components/ui`
- nao edites `apps/web/src/routeTree.gen.ts` manualmente
- usa rotas e shells placeholder apenas para scaffolding; a UI de produto passa para as equipas de funcionalidade quando a implementacao comecar

---

## Alteracoes Sensiveis Do Ponto De Vista Arquitetural

Estas alteracoes exigem cuidado extra:

- nova app ou servico
- alteracoes na estrutura do repositorio
- alteracoes em contratos partilhados
- alteracoes na ownership da base de dados
- alteracoes no modelo de filas/workers
- alteracoes de infraestrutura / CI / deployment

Para estas alteracoes:

- documenta o racional
- explicita os trade-offs no PR
- atualiza a documentacao de arquitetura quando necessario

---

## Basicos De Seguranca

- nunca facas commit de segredos reais
- nunca facas commit de ficheiros `.env` com valores reais
- usa `.env.example` apenas para variaveis documentadas
- reporta imediatamente segredos expostos e faz a sua rotacao

---

## Code Owners

Algumas pastas podem exigir review de maintainers designados atraves de `CODEOWNERS`.

---

## Definicao De Concluido

Uma alteracao e considerada concluida quando:

- o codigo esta implementado
- os testes relevantes passam
- a documentacao de setup local ou de runtime foi atualizada se o fluxo de developer mudou
- a documentacao foi atualizada quando necessario
- o PR foi revisto
- as conversas foram resolvidas
- a alteracao foi integrada atraves de squash merge
