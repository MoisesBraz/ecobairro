import { HttpError } from '@/lib/http/fetch-json'
import { apiErrorResponseSchema, type ApiErrorCode } from '@ecobairro/contracts'

/** Limite de caracteres que uma mensagem de erro pode ter para ser exibida ao utilizador. */
const MAX_USER_MESSAGE_LENGTH = 200;

/** Códigos HTTP usados para fallback de mensagens amigáveis. */
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_THRESHOLD = 500;

/**
 * Mensagens que vêm do framework (Express/Nest) e que não devem ser
 * mostradas literalmente ao utilizador final. O backend já normaliza os erros
 * (ver `HttpExceptionFilter`), pelo que este filtro é apenas defesa-em-profundidade
 * para algum endpoint que ainda devolva texto cru.
 */
const TECHNICAL_MESSAGE_PATTERNS: RegExp[] = [
  /^Cannot (GET|POST|PUT|PATCH|DELETE) /i,
  /^Internal server error$/i,
  /^Service Unavailable$/i,
  /^Bad Gateway$/i,
  /^ECONNREFUSED/i,
  /^ENOTFOUND/i,
  /PrismaClient/i,
  /^Bad Request/i,
  /must be a/i,
  /must be an/i,
  /must contain/i,
  /is required/i,
  /should not be empty/i,
  /must be longer than/i,
  /must be shorter than/i,
]

function isTechnical(message: string): boolean {
  return TECHNICAL_MESSAGE_PATTERNS.some((re) => re.test(message))
}

/**
 * Mensagem amigável para um determinado status HTTP, usada quando a
 * mensagem do backend é técnica ou não existe.
 */
function fallbackForStatus(status: number, fallback: string): string {
  if (status >= HTTP_SERVER_ERROR_THRESHOLD) {
    return 'Serviço indisponível neste momento. Tente novamente daqui a pouco.'
  }
  if (status === HTTP_UNAUTHORIZED) return 'Sessão inválida ou expirada. Inicie sessão novamente.'
  if (status === HTTP_FORBIDDEN) return 'Não tem permissão para esta acção.'
  if (status === HTTP_NOT_FOUND) return 'O recurso pedido não foi encontrado.'
  if (status === HTTP_CONFLICT) return 'Já existe um registo com estes dados.'
  if (status === HTTP_TOO_MANY_REQUESTS) return 'Demasiadas tentativas. Tente novamente mais tarde.'
  return fallback
}

export interface ApiError {
  /** Código estável devolvido pelo backend (quando disponível). */
  code?: ApiErrorCode
  /** Mensagem PT amigável, pronta para mostrar ao utilizador. */
  message: string
}

/**
 * Normaliza qualquer erro num `{ code?, message }` pronto a mostrar.
 *
 * - 5xx → "Serviço indisponível…" (independentemente do body)
 * - Body no contrato `ApiErrorResponse` ({ statusCode, code, message }) → usa
 *   o `code` (para ramificar UI) e a `message` PT do backend (fonte de verdade)
 * - 4xx legado com `{ message }` → usa essa mensagem se não for técnica
 * - Caso contrário → fallback por status (ou o `fallback` fornecido)
 */
export function getApiError(error: unknown, fallback: string): ApiError {
  if (!(error instanceof HttpError)) {
    return { message: fallback }
  }

  const statusFallback = fallbackForStatus(error.status, fallback)

  if (error.status >= HTTP_SERVER_ERROR_THRESHOLD) {
    return { message: statusFallback }
  }

  // Contrato normalizado do backend: { statusCode, code, message }.
  const parsed = apiErrorResponseSchema.safeParse(error.body)
  if (parsed.success) {
    const { code, message } = parsed.data
    if (message && !isTechnical(message) && message.length < MAX_USER_MESSAGE_LENGTH) {
      return { code, message }
    }
    return { code, message: statusFallback }
  }

  // Fallback legado: body com `message` mas sem code.
  const { body } = error
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const raw = (body as { message: unknown }).message
    const candidate =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw) && raw.length > 0
          ? String(raw[0])
          : ''

    if (candidate && !isTechnical(candidate) && candidate.length < MAX_USER_MESSAGE_LENGTH) {
      return { message: candidate }
    }
  }

  return { message: statusFallback }
}

/**
 * Devolve uma mensagem pronta para mostrar ao utilizador.
 * Atalho sobre `getApiError` para os casos que só precisam do texto.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiError(error, fallback).message
}
