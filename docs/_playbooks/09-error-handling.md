# Tratamento de erros (API → Web)

> Como a plataforma transforma erros do backend em mensagens **simples e
> amigáveis em pt-PT** para o utilizador, sem nunca expor texto técnico, códigos
> internos, stack traces ou mensagens em inglês do framework.

## O quê / porquê

Antes, a API devolvia o formato por defeito do NestJS (`{ statusCode, message, error }`)
e algumas exceções traziam texto cru em inglês (`"Missing bearer token"`,
`"Insufficient permissions"`, `"Report not found"`, ...). Esse texto chegava
literalmente ao ecrã, ou então o frontend caía numa mensagem genérica
("Serviço indisponível…"). Não havia forma estável de o frontend distinguir
*que* erro ocorreu.

A solução tem três peças:

1. **Contrato de erros partilhado** em `@ecobairro/contracts` — código
   máquina-legível + forma única da resposta.
2. **Filtro global no backend** que normaliza **todas** as respostas de erro.
3. **Frontend** que lê esse contrato e mostra a mensagem pronta (e pode ramificar
   pelo `code`).

## 1. Contrato — `packages/contracts/src/errors.ts`

Toda a resposta de erro respeita `ApiErrorResponse`:

```ts
interface ApiErrorResponse {
  statusCode: number;       // status HTTP (401, 403, 404, 409, 400, 5xx)
  code: ApiErrorCode;       // código estável, ex.: 'AUTH_INVALID_CREDENTIALS'
  message: string;          // mensagem pt-PT pronta a mostrar ao utilizador
  error?: string;           // nome curto (compat), opcional
  details?: { field?: string; message: string }[]; // erros de validação
}
```

- `ApiErrorCode` é a lista fechada de códigos (auth, autorização, recurso,
  conflito, genéricos). É a **chave estável** que o frontend pode usar para
  comportamento específico (ex.: `AUTH_EMAIL_NOT_VERIFIED` → mostrar "reenviar email").
- `apiErrorResponseSchema` (Zod) permite ao frontend validar o corpo do erro em runtime.

## 2. Backend — `apps/api/src/common/errors/`

| Ficheiro | Papel |
|----------|-------|
| `error-catalog.ts` | **Fonte de verdade** das mensagens pt-PT (mapa `code → { status, message }`). |
| `app-exception.ts` | Helpers `unauthorized` / `forbidden` / `notFound` / `conflict` / `badRequest` que criam exceções **nativas do Nest** com o `code` embutido. |
| `http-exception.filter.ts` | Filtro global `@Catch()` que produz sempre um `ApiErrorResponse`. |

Lançar erros nos services/guards/controllers usa os helpers (não `new XException('texto')`):

```ts
import { forbidden, notFound, conflict } from '../common/errors';

if (role !== 'CIDADAO') throw forbidden();                 // 403, 'FORBIDDEN'
if (!report) throw notFound('REPORT_NOT_FOUND');           // 404, msg do catálogo
throw conflict('AUTH_EMAIL_TAKEN');                        // 409, 'Este email já está registado.'
```

Mensagens dinâmicas passam o texto explícito (o `code` mantém-se estável):

```ts
throw forbidden('AUTH_ACCOUNT_LOCKED', `Conta bloqueada. Tente novamente em ${min} minutos.`);
```

O filtro (registado em `main.ts` via `app.useGlobalFilters(new HttpExceptionFilter())`):

- exceções dos helpers → usam o `code` + `message` embutidos;
- exceções **nativas** do Nest com mensagem pt-PT → preservam a mensagem (e atribuem
  `code` por status); frases genéricas em inglês do framework (`"Unauthorized"`, ...)
  são substituídas pela mensagem do catálogo;
- erros de validação (`ValidationPipe`/`class-validator`) → `code: 'VALIDATION_ERROR'`,
  mensagem amigável e o array de mensagens em `details[]`;
- **5xx e erros inesperados** → mensagem genérica (`INTERNAL`); o erro real só vai
  para os logs — **nunca** stack, Prisma ou texto interno na resposta.

> A validação continua a ser feita com **`class-validator`** nos DTOs do backend e
> com **Zod** nos formulários do frontend — o contrato/filtro de erros é a camada
> que uniformiza o que chega ao utilizador.

## 3. Frontend — `apps/web/src/lib/http/api-error.ts`

```ts
import { getApiError, getApiErrorMessage } from '@/lib/http/api-error';

try {
  await guardarEcoponto(data);
} catch (err) {
  // Só preciso do texto:
  setSubmitError(getApiErrorMessage(err, 'Não foi possível guardar o ecoponto.'));

  // Ou ramificar pelo código:
  const { code, message } = getApiError(err, 'Não foi possível iniciar sessão.');
  if (code === 'AUTH_EMAIL_NOT_VERIFIED') setShowResend(true);
  setSubmitError(message);
}
```

- O body do erro é validado com `apiErrorResponseSchema`; quando válido, mostra-se a
  `message` do backend (fonte de verdade) e expõe-se o `code`.
- Mantém-se um fallback por status HTTP e um filtro de "mensagens técnicas" como
  **defesa-em-profundidade**, caso algum endpoint antigo ainda devolva texto cru.

## Regras

- **Backend:** lançar erros com os helpers (`forbidden`/`notFound`/...), nunca com
  texto cru em inglês. Mensagens novas vão para o `error-catalog.ts`.
- **Backend:** nunca devolver detalhes internos em 5xx — logar, devolver genérico.
- **Frontend:** mostrar erros sempre via `getApiError`/`getApiErrorMessage` (ver
  [[07-web-implementation-playbook]]), nunca `err.message` cru.
- **Contratos:** adicionar um novo `code` em `errors.ts` **e** a respetiva entrada
  em `error-catalog.ts` no mesmo PR.

## Ver também

- [[08-api-implementation-playbook]] · [[07-web-implementation-playbook]]
- `packages/contracts/src/errors.ts` · `apps/api/src/common/errors/` · `apps/web/src/lib/http/api-error.ts`
