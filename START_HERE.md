# COMECAR AQUI

Este ficheiro e o ponto de entrada mais rapido para a documentacao atual do projeto.

Se estas a abrir o repositorio pela primeira vez, le por esta ordem:

1. `README.md`
2. `docs/05-local-runtime-bootstrap.md`
3. `docs/08-api-implementation-playbook.md` se vais trabalhar em backend ou infra
4. `docs/07-web-implementation-playbook.md` se vais trabalhar em frontend

## Orientacao Rapida

O repositorio tem atualmente:

- `apps/web`: frontend
- `apps/api`: backend principal
- `apps/analytics`: servico de analytics
- `packages/`: pacotes TypeScript partilhados
- `infra/`: Docker Compose, nginx e scripts de runtime local
- `docs/`: documentacao para a equipa e documentacao de dominio/design

## Se Precisares De Executar O Projeto

Le:

- `README.md`
- `docs/05-local-runtime-bootstrap.md`

Comandos principais a partir da raiz do repositorio:

```powershell
pnpm install --no-frozen-lockfile
pnpm compose:up
pnpm --dir apps/api exec prisma migrate deploy
pnpm compose:ps
```

URLs locais principais:

- `http://localhost:8080/`
- `http://localhost:8080/api/health`
- `http://localhost:8080/api/ready`
- `http://localhost:8080/api/v1/auth/login`

## Se Precisares De Perceber O Backend Atual

Le:

- `docs/08-api-implementation-playbook.md`
- `apps/api/src/`
- `packages/contracts/src/index.ts`
- `apps/api/prisma/schema.prisma`

Ambito backend atualmente implementado:

- registo de cidadao
- login
- rotacao de refresh token
- logout
- leitura e atualizacao do proprio perfil de cidadao
- verificacoes de prontidao para PostgreSQL e Redis

## Se Precisares De Adicionar Uma Funcionalidade De Backend

Comeca por:

- `docs/08-api-implementation-playbook.md`

Depois, normalmente vais tocar nestes sitios, por esta ordem:

1. `packages/contracts/src/index.ts`
2. `apps/api/prisma/schema.prisma` e migrations, se a persistencia mudar
3. o modulo responsavel em `apps/api/src/`
4. os testes em `apps/api/src/`
5. a documentacao

## Se Precisares De Perceber O Frontend

Le:

- `docs/06-frontend-scaffold.md`
- `docs/07-web-implementation-playbook.md`

## Se Precisares De Contexto De Dominio Ou Produto

Le:

- `docs/models/`

Pontos de entrada uteis:

- `docs/models/Cidadão/Init.md`
- `docs/models/Ecopontos, Zonas, Badges e Quiz/Init.md`

Nota importante:

- alguns ficheiros em `docs/models/` ainda sao documentos de planeamento/design
- nem tudo o que esta la ja foi implementado
- para o estado real atual do backend, confia em `docs/08-api-implementation-playbook.md`

## Se Precisares De Fazer Troubleshooting Ao Contentor Da Base De Dados

Le:

- `docs/05-local-runtime-bootstrap.md`

Factos importantes neste momento:

- o PostgreSQL local corre em Docker como `postgres`
- a ligacao a partir do host usa `localhost:5432`
- a BD/utilizador/password por omissao e `ecobairro`
- o PostGIS e ativado na primeira inicializacao da BD
- a Prisma CLI no host usa `apps/api/prisma.config.ts`

## Se Precisares De Saber O Que Esta Implementado Vs Planeado

Usa esta regra:

- comportamento implementado de runtime/setup/backend: `README.md`, `docs/05-local-runtime-bootstrap.md`, `docs/08-api-implementation-playbook.md`
- plano de dominio mais amplo e ambito futuro: `docs/models/`

## Leitura Sugerida Por Perfil

Backend/Infra:

1. `README.md`
2. `docs/05-local-runtime-bootstrap.md`
3. `docs/08-api-implementation-playbook.md`
4. `docs/models/Cidadão/Init.md`

Frontend:

1. `README.md`
2. `docs/06-frontend-scaffold.md`
3. `docs/07-web-implementation-playbook.md`

Produto/Arquitetura:

1. `README.md`
2. `docs/models/`
3. `docs/08-api-implementation-playbook.md`

## Melhor Ponto De Entrada Neste Momento

Se nao souberes por onde comecar, segue esta ordem:

1. `README.md`
2. `docs/05-local-runtime-bootstrap.md`
3. `docs/08-api-implementation-playbook.md`

Este percurso reflete o codigo atual com mais fidelidade do que os documentos de planeamento mais antigos.
