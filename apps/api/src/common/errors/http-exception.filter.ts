import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
} from '@ecobairro/contracts';
import { ERROR_CATALOG } from './error-catalog';

/** Deriva um code default a partir do status HTTP (exceções nativas do Nest). */
function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'AUTH_UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL' : 'FORBIDDEN';
  }
}

/**
 * Frases genéricas em inglês que o Nest usa quando uma exceção é criada sem
 * mensagem (ex.: `new UnauthorizedException()`). Não devem chegar ao utilizador
 * — quando aparecem, cai-se para a mensagem PT do catálogo.
 */
const GENERIC_STATUS_PHRASES = new Set([
  'unauthorized',
  'forbidden',
  'not found',
  'bad request',
  'conflict',
  'internal server error',
  'service unavailable',
  'too many requests',
]);

/**
 * Filtro global: normaliza TODA a resposta de erro para `ApiErrorResponse`
 * `{ statusCode, code, message, details? }`.
 *
 * Regras:
 * - Nunca expõe stack traces, erros de Prisma ou texto interno.
 * - 5xx → mensagem genérica do catálogo (`INTERNAL`); o erro real só vai para os logs.
 * - Erros de validação (400, class-validator) → mensagem amigável + `details[]`.
 * - Exceções dos helpers (`forbidden`/`notFound`/...) → usam o `code` + `message` embutidos.
 * - Exceções nativas do Nest com mensagem PT → preservam a mensagem + code por status.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toApiError(exception);
    response.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown): ApiErrorResponse {
    // Exceção HTTP do Nest (helpers com code, exceções nativas, ValidationPipe).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      // Helper com código embutido ({ code, message }).
      const coded = this.extractCoded(raw);
      if (coded) {
        return { statusCode: status, code: coded.code, message: coded.message };
      }

      // Validação (array de mensagens) → details + mensagem amigável do catálogo.
      const details = this.extractValidationDetails(raw);
      if (details) {
        return {
          statusCode: status,
          code: 'VALIDATION_ERROR',
          message: ERROR_CATALOG.VALIDATION_ERROR.message,
          details,
        };
      }

      // 5xx nunca expõe a mensagem original.
      if (status >= 500) {
        this.logger.error(`HTTP ${status}`, exception.stack);
        return this.fromCatalog('INTERNAL');
      }

      // 4xx: preserva mensagem PT já amigável; cai para o catálogo se for vazia
      // ou uma frase genérica em inglês do framework.
      const code = codeForStatus(status);
      const original = this.extractMessage(raw);
      const usable =
        original !== null &&
        original.trim().length > 0 &&
        !GENERIC_STATUS_PHRASES.has(original.trim().toLowerCase());
      return {
        statusCode: status,
        code,
        message: usable ? original : ERROR_CATALOG[code].message,
      };
    }

    // 3. Erro inesperado → 500 genérico; detalhe só nos logs.
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return this.fromCatalog('INTERNAL');
  }

  private fromCatalog(code: ApiErrorCode): ApiErrorResponse {
    const entry = ERROR_CATALOG[code];
    return { statusCode: entry.status, code, message: entry.message };
  }

  /** Extrai `{ code, message }` quando a exceção veio dos helpers com código. */
  private extractCoded(raw: unknown): { code: ApiErrorCode; message: string } | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const { code, message } = raw as { code?: unknown; message?: unknown };
    if (typeof code !== 'string' || !(code in ERROR_CATALOG)) return null;
    const text = typeof message === 'string' ? message : ERROR_CATALOG[code as ApiErrorCode].message;
    return { code: code as ApiErrorCode, message: text };
  }

  /** Extrai uma mensagem string do corpo de uma HttpException (não-array). */
  private extractMessage(raw: unknown): string | null {
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null) {
      const message = (raw as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return null;
  }

  /** Converte o array de mensagens do ValidationPipe em ApiErrorDetail[]. */
  private extractValidationDetails(raw: unknown): ApiErrorDetail[] | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const message = (raw as { message?: unknown }).message;
    if (!Array.isArray(message)) return null;
    return message
      .filter((m): m is string => typeof m === 'string')
      .map((m) => ({ message: m }));
  }
}
