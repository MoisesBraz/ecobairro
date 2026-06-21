import { z } from 'zod';

/**
 * Códigos de erro estáveis e máquina-legíveis devolvidos pela API.
 *
 * O frontend usa o `code` para tratamento específico (ramificar UI, ex.: mostrar
 * um botão "reenviar email" quando `AUTH_EMAIL_NOT_VERIFIED`). A mensagem PT
 * amigável associada a cada código é a fonte de verdade no backend, em
 * `apps/api/src/common/errors/error-catalog.ts`.
 */
export const API_ERROR_CODES = [
  // Autenticação / sessão
  'AUTH_UNAUTHENTICATED',
  'AUTH_SESSION_REVOKED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_NOT_VERIFIED',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_EMAIL_TAKEN',
  'AUTH_INVALID_VERIFICATION',
  'AUTH_INVALID_RESET_TOKEN',
  'AUTH_PASSWORD_INCORRECT',
  'AUTH_2FA_EXPIRED',
  'AUTH_2FA_INVALID',
  'AUTH_2FA_ALREADY_ENABLED',
  'AUTH_INVALID_GOOGLE_TOKEN',
  'AUTH_INVALID_GOOGLE_CLIENT',
  // Autorização
  'FORBIDDEN',
  // Recurso não encontrado
  'NOT_FOUND',
  'REPORT_NOT_FOUND',
  'ECOPONTO_NOT_FOUND',
  'USER_NOT_FOUND',
  'CITIZEN_PROFILE_NOT_FOUND',
  // Conflito
  'CONFLICT',
  'ECOPONTO_ALREADY_FAVORITE',
  // Gamificação / quiz
  'QUIZ_OPT_IN_REQUIRED',
  'QUIZ_UNAVAILABLE',
  'QUIZ_SESSION_NOT_FOUND',
  // Genéricos
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Detalhe campo-a-campo, usado em erros de validação. */
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

/**
 * Forma única de TODA a resposta de erro da API. Garantida pelo filtro global
 * `HttpExceptionFilter` no backend — nunca contém stack traces nem texto interno.
 */
export interface ApiErrorResponse {
  statusCode: number;
  code: ApiErrorCode;
  /** Mensagem PT amigável, pronta para mostrar ao utilizador. */
  message: string;
  /** Nome curto do erro (compat NestJS), ex.: "Forbidden". Opcional. */
  error?: string;
  /** Detalhes de validação (um por campo inválido). */
  details?: ApiErrorDetail[];
}

const apiErrorDetailSchema: z.ZodType<ApiErrorDetail> = z.object({
  field: z.string().optional(),
  message: z.string(),
});

/** Schema Zod para parsing seguro do body de erro no frontend. */
export const apiErrorResponseSchema = z.object({
  statusCode: z.number(),
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  error: z.string().optional(),
  details: z.array(apiErrorDetailSchema).optional(),
});

/** Type guard runtime: confirma que um body desconhecido respeita ApiErrorResponse. */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return apiErrorResponseSchema.safeParse(value).success;
}
