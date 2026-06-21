# Guia De Implementacao Web

## Objetivo

Este documento explica como a equipa deve implementar trabalho dentro de `apps/web` no estado atual do projeto.

Usa este guia quando estiveres a:

- adicionar uma nova pagina
- estender um grupo de rotas existente
- introduzir UI partilhada
- ligar chamadas a API
- adicionar testes frontend

Este e o complemento de "como construir sobre o scaffold" ao [docs/06-frontend-scaffold.md](06-frontend-scaffold.md), que explica a arquitetura e porque o stack foi escolhido.

## Modelo Mental Rapido

Antes de mudares qualquer coisa em `apps/web`, mantem esta divisao em mente:

- `src/routes`: ficheiros de rota e route layouts
- `src/components/layout`: enquadramento de pagina ao nivel da app e das areas
- `src/components/ui`: pequenos blocos presentacionais reutilizaveis
- `src/lib`: infraestrutura partilhada que nao e UI
- `src/styles`: estilos globais e tokens
- `src/test`: setup de testes partilhado e testes ao nivel da app

Se um ficheiro nao encaixa claramente numa destas categorias, para e simplifica a alteracao antes de introduzir um novo padrao.

## Workflow De Implementacao

Para a maior parte do trabalho frontend, a ordem segura e:

1. Decidir que rota detem o trabalho.
2. Adicionar ou atualizar o ficheiro de rota em `src/routes`.
3. Adicionar layout partilhado ou UI apenas se a rota precisar de estrutura reutilizavel.
4. Adicionar acesso a dados atraves de `src/lib/http` e TanStack Query quando a rota precisar de dados remotos.
5. Adicionar ou atualizar testes.
6. Correr a validacao antes de abrir um PR.

Esta ordem mantem a ownership da rota obvia e impede que abstrações partilhadas aparecam demasiado cedo.

## Passo 1: Escolher A Area De Rotas Certa

Hoje a app tem tres areas principais de rotas:

- `/` para a pagina de entrada neutra
- `/app/*` para paginas viradas para o cidadao
- `/admin/*` para paginas de gestor/admin

Exemplos:

- uma pagina de perfil de cidadao deve viver em `src/routes/app`
- uma pagina interna de moderacao ou operacoes deve viver em `src/routes/admin`
- uma pagina global de landing ou handoff deve viver em `src/routes`

Ficheiros relevantes:

- [apps/web/src/routes/index.tsx](../apps/web/src/routes/index.tsx)
- [apps/web/src/routes/app/route.tsx](../apps/web/src/routes/app/route.tsx)
- [apps/web/src/routes/admin/route.tsx](../apps/web/src/routes/admin/route.tsx)

## Passo 2: Adicionar Ou Atualizar Uma Rota

As rotas sao escritas com TanStack Router file-based routing.

Isto significa que o caminho do ficheiro define o URL.

Exemplos:

- `src/routes/app/profile.tsx` passa a `/app/profile`
- `src/routes/admin/users.tsx` passa a `/admin/users`

Parte de uma rota existente como template:

- [apps/web/src/routes/app/index.tsx](../apps/web/src/routes/app/index.tsx)
- [apps/web/src/routes/admin/dashboard.tsx](../apps/web/src/routes/admin/dashboard.tsx)

O padrao habitual da rota e:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/profile")({
  component: AppProfilePage,
});

function AppProfilePage() {
  return <div>Substituir por conteudo real da pagina.</div>;
}
```

Regras:

- mantem os ficheiros de rota focados na ownership da rota
- nao coloques providers globais dentro de ficheiros de rota
- prefere extrair UI reutilizavel em vez de deixar uma rota crescer ate ficar gigante

## Passo 3: Deixar O TanStack Regenerar A Route Tree

Depois de adicionares ou renomeares ficheiros de rota, o TanStack regenera [apps/web/src/routeTree.gen.ts](../apps/web/src/routeTree.gen.ts).

Regras importantes:

- nao edites `routeTree.gen.ts` manualmente
- faz commit do ficheiro depois de alteracoes em rotas
- trata-o como codigo fonte gerado, nao como output descartavel de build

Este ficheiro existe para manter as definicoes tipadas de rotas sincronizadas com a arvore `src/routes`.

## Passo 4: Decidir Se A Alteracao E Local Da Rota Ou Partilhada

Antes de criares novo codigo partilhado, pergunta:

- isto esta a ser usado apenas numa rota neste momento?
- a reutilizacao e real, ou estou a adivinha-la?

Usa estas regras:

- mantem o codigo dentro da rota quando o comportamento e local
- move codigo para `components/ui` quando for uma pequena peca presentacional reutilizavel
- move codigo para `components/layout` quando afetar enquadramento partilhado da pagina ou navegacao
- move codigo para `lib` quando for infraestrutura partilhada que nao e UI

Evita criar feature folders especulativos, a menos que comecem a aparecer de facto padroes repetidos de logica de dominio.

## Passo 5: Usar Corretamente A Camada De Layout Existente

O scaffold ja tem dois niveis de layout:

- shell app-wide em [apps/web/src/components/layout/root-frame.tsx](../apps/web/src/components/layout/root-frame.tsx)
- area shells em [apps/web/src/components/layout/area-shell.tsx](../apps/web/src/components/layout/area-shell.tsx)

Usa `components/layout` para:

- headers partilhados
- navegacao de secao
- enquadramento comum de conteudo
- shells para grupos de rotas

Nao uses `components/layout` para:

- cards de uso unico
- pequenos botoes
- widgets especificos de dominio que apenas uma pagina precisa

Se um componente responde sobretudo a pergunta "como e que esta area da pagina esta estruturada?", provavelmente e codigo de layout.

## Passo 6: Usar `components/ui` Para Pecas Presentacionais Neutras

`components/ui` serve para pecas reutilizaveis que permanecem genericas entre rotas.

Exemplos atuais:

- [apps/web/src/components/ui/surface-card.tsx](../apps/web/src/components/ui/surface-card.tsx)
- [apps/web/src/components/ui/route-pending.tsx](../apps/web/src/components/ui/route-pending.tsx)
- [apps/web/src/components/ui/not-found.tsx](../apps/web/src/components/ui/not-found.tsx)

Usa `components/ui` quando um componente e:

- generico
- presentacional
- nao esta ligado a um grupo de rotas especifico
- nao esta acoplado a uma funcionalidade de dominio concreta

Nao coloques chamadas API, logica de ownership de rotas ou providers app-wide em `components/ui`.

## Passo 7: Adicionar Acesso A Dados Atraves Da Camada Partilhada De HTTP E Query

O scaffold atual ja te da:

- um request helper generico em [apps/web/src/lib/http/fetch-json.ts](../apps/web/src/lib/http/fetch-json.ts)
- um Query client app-wide em [apps/web/src/lib/query/client.ts](../apps/web/src/lib/query/client.ts)
- configuracao de env em [apps/web/src/lib/env.ts](../apps/web/src/lib/env.ts)

Padrao preferencial:

1. Adicionar uma pequena funcao de loader ou query especifica da rota.
2. Usar `fetchJson` para a chamada de rede.
3. Usar TanStack Query no componente da rota se os dados forem carregados do lado do cliente.

Formato de exemplo:

```tsx
import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "../lib/http/fetch-json";
import { clientEnv } from "../lib/env";

function ExamplePage() {
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: () =>
      fetchJson("/api/reports", {
        baseUrl: clientEnv.apiBaseUrl,
      }),
  });

  if (reportsQuery.isPending) {
    return <div>A carregar...</div>;
  }

  if (reportsQuery.isError) {
    return <div>Ocorreu um erro.</div>;
  }

  return <pre>{JSON.stringify(reportsQuery.data, null, 2)}</pre>;
}
```

Orientacoes:

- mantem `fetchJson` como default de baixo nivel, a menos que exista um motivo forte para o substituir
- evita espalhar chamadas `fetch(...)` em bruto pelos ficheiros de rota
- prefere uma query clara por necessidade da rota em vez de inventar um SDK completo cedo demais

## Passo 8: Ler Env Vars Apenas Atraves De `clientEnv`

Nao leias `import.meta.env` diretamente por toda a app.

Em vez disso, usa [apps/web/src/lib/env.ts](../apps/web/src/lib/env.ts).

Porquê:

- o parsing das env vars fica centralizado
- a validacao permanece consistente
- futuras alteracoes de env precisam de um unico caminho de atualizacao

Se uma nova env var frontend for realmente necessaria:

1. adiciona-a em `src/lib/env.ts`
2. documenta-a em `.env.example`
3. menciona-a na documentacao relevante se os colegas precisarem de a configurar localmente

## Passo 9: Fazer Styling Com Os Tokens E Classes Partilhadas Existentes Primeiro

A camada de styling atual vive em:

- [apps/web/src/styles/tokens.css](../apps/web/src/styles/tokens.css)
- [apps/web/src/styles/app.css](../apps/web/src/styles/app.css)

Ordem de preferencia para styling:

1. reutilizar uma classe semantica existente, se ja existir
2. usar utilitarios Tailwind quando o styling for local ao componente
3. adicionar ou estender tokens quando a decisao de design for global

Bons casos de uso para tokens:

- cores partilhadas
- tons de texto consistentes
- backgrounds de superficie

Bons casos de uso para utilitarios locais:

- espacamento pontual
- ajustes de grid
- alinhamento local

Evita enterrar os mesmos valores magicos em varios ficheiros de rota.

## Passo 10: Manter Providers E Wiring Global Na Root

Os providers globais vivem em [apps/web/src/routes/__root.tsx](../apps/web/src/routes/__root.tsx).

Esse ficheiro e responsavel por:

- document shell
- ligacao da stylesheet da app
- Query client provider
- devtools
- root layout
- comportamento root-level para erro e not-found

So deves alterar `__root.tsx` quando o comportamento for realmente global.

Nao movas preocupacoes especificas de rotas para a root apenas porque sao partilhadas por duas paginas vizinhas.

## Passo 11: Adicionar Testes Seguindo Os Padroes Atuais

O scaffold ja inclui:

- [apps/web/src/test/home-page.test.tsx](../apps/web/src/test/home-page.test.tsx)
- [apps/web/src/components/layout/root-frame.test.tsx](../apps/web/src/components/layout/root-frame.test.tsx)
- [apps/web/src/lib/env.test.ts](../apps/web/src/lib/env.test.ts)

Usa-os como baseline.

Regras de teste:

- testa comportamento, nao detalhes triviais de implementacao
- adiciona testes de rota quando a saida ou os estados de loading mudarem
- adiciona testes de utilitarios quando a logica partilhada ganhar branching relevante
- mantem os nomes dos testes legiveis e focados na funcionalidade

## Passo 12: Correr O Conjunto Normal De Validacao Frontend

A partir da raiz do repositorio:

```bash
pnpm --filter @ecobairro/web lint
pnpm --filter @ecobairro/web typecheck
pnpm --filter @ecobairro/web test
pnpm --filter @ecobairro/web build
```

Executa os quatro antes de abrir um PR frontend, a menos que a alteracao seja apenas de documentacao.

## Checklist Sugerida Para Implementacao De Rotas

Usa esta checklist quando fores implementar uma nova pagina:

1. Escolhe a area de rotas certa: `/`, `/app` ou `/admin`.
2. Cria ou atualiza o ficheiro de rota em `src/routes`.
3. Reutiliza uma layout shell existente sempre que possivel.
4. Extrai para `components/ui` apenas UI realmente partilhada.
5. Usa `fetchJson` e Query quando a pagina precisar de dados vindos da API.
6. Mantem o acesso a env dentro de `clientEnv`.
7. Deixa `routeTree.gen.ts` regenerar e faz commit do ficheiro.
8. Adiciona ou atualiza testes.
9. Corre `lint`, `typecheck`, `test` e `build`.

## Tratamento De Erros Da API

Mostra erros vindos da API sempre via `getApiError`/`getApiErrorMessage`
(`src/lib/http/api-error.ts`), nunca `err.message` cru. O backend já devolve uma
mensagem pt-PT pronta + um `code` estável (que podes usar para ramificar a UI).
Detalhe completo do contrato e do filtro global em
[docs/_playbooks/09-error-handling.md](09-error-handling.md).

```ts
const { code, message } = getApiError(err, 'Não foi possível guardar.');
if (code === 'AUTH_EMAIL_NOT_VERIFIED') setShowResend(true);
setSubmitError(message);
```

## O Que Nao Fazer

Evita estes erros:

- mostrar `err.message` cru ao utilizador (usa sempre `getApiErrorMessage`)
- editar `routeTree.gen.ts` manualmente
- criar novos providers globais dentro de ficheiros de rota
- colocar logica de dominio especifica em `components/ui` genericos
- ler `import.meta.env` diretamente por toda a app
- adicionar abstrações partilhadas demasiado amplas antes de haver reutilizacao real
- fazer commit de `.tanstack`, `.output` ou `.nitro`

## Referencias Recomendadas Para Comecar

Quando fores implementar em `apps/web`, começa por ler:

- [docs/06-frontend-scaffold.md](06-frontend-scaffold.md)
- [apps/web/src/routes/__root.tsx](../apps/web/src/routes/__root.tsx)
- [apps/web/src/router.tsx](../apps/web/src/router.tsx)
- [apps/web/src/lib/http/fetch-json.ts](../apps/web/src/lib/http/fetch-json.ts)
- um ficheiro de rota proximo da area que vais alterar

Isto costuma ser contexto suficiente para fazer uma alteracao limpa sem teres de reaprender o stack inteiro do zero.
