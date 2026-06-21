# WEB app (frontend ecoBairro)

SPA React + TanStack Router (routing por ficheiros), TanStack Query, Tailwind
CSS e tipos partilhados via `@ecobairro/contracts`. Os pedidos à API passam por
`lib/http/fetch-json.ts` (`fetchJson`) com `baseUrl: clientEnv.apiBaseUrl`.

## Estrutura relevante

```text
apps/web/src/
  routes/                 # rotas (TanStack Router, file-based)
    _layoutmain.*.tsx     # área autenticada (dashboard, admin, ...)
    _layoutpublic.*.tsx   # área pública
  lib/
    auth.ts               # sessão, getAccessToken, requireRole
    http/fetch-json.ts    # cliente HTTP tipado + HttpError
    http/api-error.ts     # getApiErrorMessage
    env.ts                # clientEnv.apiBaseUrl
  types/                  # tipos UI (UserRole, ...)
```

## Convenções

- Papéis em **minúsculas** (`cidadao`, `operador`, `gestor`, `admin`) —
  alinhados com a API (4 papéis; o `gestor` engloba as antigas funções de
  técnico da Autarquia/CCDR). `requireRole([...])` (em `lib/auth.ts`) protege
  rotas e compara em minúsculas.
- Cabeçalho de autenticação: `Authorization: Bearer <getAccessToken()>`.
- Erros de API: capturar e mostrar via `getApiErrorMessage(err, fallback)`.

## Módulo: Gestão de Utilizadores (admin)

Rota: `routes/_layoutmain.utilizadores.tsx` — protegida por `requireRole(['admin'])`.

### O que foi realizado

- Listagem de utilizadores (`GET /v1/users`) com filtros por papel/estado e pesquisa.
- **Select de papéis alinhado com o schema da BD**: as opções vêm de
  `GET /v1/admin/roles` (`papeis: AdminRoleOption[]`), com `FALLBACK_ROLES` local
  (os 6 papéis) caso o pedido falhe. Cores por papel em `roleColors` (apresentação).
- Edição inline do papel (`PATCH /v1/admin/users/:id/role`), com `<option>`
  defensiva para papéis fora da lista (evita dessincronizar o select controlado).
- Criar utilizador (`POST /v1/admin/users` — `{ nome, email, role }`; a password
  é gerada no backend e enviada por email).
- Desativar (`DELETE /v1/admin/users/:id`) e reativar (`PATCH .../reativar`).

### O que falta realizar

- Edição de mais campos do utilizador (email/telefone) pelo admin.
- Confirmação antes de alterar papel (hoje só a desativação pede confirmação).
- Atualização otimista em vez de recarregar a lista (`load()`) após cada ação.

### O que não fazer

- Não voltar a hardcodar a lista de papéis nos selects — usar o estado `papeis`
  (servido pelo endpoint); manter `FALLBACK_ROLES` completo (inclui `gestor`).
- Não enviar papéis em maiúsculas para a API — usar os `value` em minúsculas.
- Não remover o fallback defensivo do select inline.

## Módulo: Quiz & Gamificação (cidadão)

Rota: `routes/_layoutmain.quiz.tsx` — protegida por `requireRole(['cidadao', 'admin'])`.
Componentes do jogo em `components/quiz/` (`quiz-play.tsx`, `quiz-result.tsx`).

### O que foi realizado

- Resumo via `GET /v1/gamification/quiz/me` (pontos, nível, ranking, conquistas,
  `optedIn`).
- Botão "Começar Agora" liga o fluxo de jogo (`QuizPlay`): `POST .../quiz/iniciar`
  → uma pergunta de cada vez com contador de tempo → `POST .../quiz/sessao/:id/responder`.
- `QuizResult` mostra acertos, pontos ganhos e **feedback educativo por pergunta**.
- CTA de adesão quando `optedIn=false`: o botão "Ativar e Jogar" chama
  `POST /v1/gamification/optin` e só depois inicia o quiz.
- Após submeter, a página recarrega `/quiz/me` (`load()`) para refletir os pontos.

### O que não fazer

- Não confiar em `correta` no payload das perguntas — só vem no resultado.
- Não duplicar o cliente HTTP: usar `fetchJson` + `Authorization: Bearer` +
  `getApiErrorMessage`.

## Módulo: Gestão de Quiz (gestor/admin)

Rota: `routes/_layoutmain.gestao-quiz.tsx` — protegida por
`requireRole(['gestor', 'admin'])`. Link na `Sidebar` (gestor + admin) e card na
consola `/admin`.

### O que foi realizado

- CRUD de perguntas do pool ativo via `/v1/admin/quiz/perguntas`
  (`GET`/`POST`/`PATCH`/`DELETE`). Lista com pesquisa + filtro por categoria
  (client-side; o endpoint devolve todas).
- Modal criar/editar: pergunta, categoria, pontos, **editor de opções** (2-6,
  adicionar/remover) com seleção única da opção correta (botão tipo radio).
  Explicação educativa obrigatória.
- Validação no cliente antes de gravar (≥2 opções com texto, exatamente 1
  correta); o backend revalida (`validateOpcoes`).
- Apagar com `confirm()`. Após cada ação recarrega a lista (`load()`).

### O que não fazer

- Não reutilizar a rota do cidadão (`/quiz`) — esta é só de gestão.
- Não enviar perguntas sem opção correta única (o backend devolve 400).
- Não duplicar o cliente HTTP: `fetchJson` + `Authorization: Bearer` +
  `getApiErrorMessage` (igual a `utilizadores`).

## Módulo: Gestão de Rotas (operador / gestor / admin)

Rota: `routes/_layoutmain.rotas.tsx` — `requireRole(['operador', 'gestor', 'admin'])`.
Modal de geração em `components/rotas/gerar-rota-modal.tsx`.

### O que foi realizado

- Lista de rotas (`GET /v1/rotas`) com mapa Leaflet: o operador vê só as suas; gestor/admin
  veem todas. Iniciar/concluir via `PATCH /v1/rotas/:id`.
- **Gerar rota (só gestor/admin)** — botão abre o modal:
  - Dropdown de zona (`GET /v1/ecopontos/zonas`), limiar de enchimento, opção "partir da
    minha posição" (`navigator.geolocation`).
  - "Calcular" chama o **serviço analytics** `GET /operacional/rota-sugestao`
    (`baseUrl: clientEnv.analyticsBaseUrl`) → pré-visualiza o traçado (`Polyline` da
    `geometria`) + paragens numeradas no mapa, com badge do motor (`osrm`/`greedy`) e
    distância/duração.
  - "Guardar rota" faz `POST /v1/rotas` (`clientEnv.apiBaseUrl`) com o `CreateRotaRequest`
    e recarrega a lista.
- O render da lista usa `r.geometria` quando existe (rotas geradas) e cai para `r.waypoints`
  nas rotas de seed; os markers usam `r.paragens` (com `ordem`/ocupação) ou caem para waypoints.

### O que não fazer

- Não duplicar o cliente HTTP: `fetchJson` + `Authorization: Bearer` + `getApiErrorMessage`.
- O cálculo da rota vive no analytics (OP4); o frontend só pré-visualiza e manda persistir.
  Não reimplementar TSP/OSRM no cliente.
- `RotaSugestaoResponse` vem em **snake_case** (espelha o FastAPI) — não renomear.

## Linkagens

- API gamificação: `apps/api/src/gamification/CLAUDE.md` (`/v1/gamification/*`)
- API admin: `apps/api/src/admin/CLAUDE.md` (`/v1/admin/*`)
- Contratos: `../../packages/contracts/src/index.ts`
  (`AdminRoleOption`, `ListRolesResponse`, `CreateUserRequest`, `UpdateUserRoleRequest`,
  `UserRecord`, `ListUsersResponse`, `AdminQuizQuestion`, `Create/UpdateQuizQuestionRequest`,
  `ListAdminQuizQuestionsResponse`)
