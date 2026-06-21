import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiErrorCode } from '@ecobairro/contracts';
import { ERROR_CATALOG } from './error-catalog';

/**
 * Helpers que criam exceções HTTP do Nest com um código máquina-legível
 * (`ApiErrorCode`) embutido no corpo da resposta.
 *
 * Continuam a ser instâncias das classes nativas do Nest (`ForbiddenException`,
 * `NotFoundException`, ...), pelo que preservam `instanceof` e `err.message`.
 * O `HttpExceptionFilter` lê o `code` do corpo para construir a `ApiErrorResponse`;
 * a mensagem PT amigável vem do `ERROR_CATALOG` (ou de `message`, p/ casos dinâmicos).
 */
function payload(code: ApiErrorCode, message?: string): { code: ApiErrorCode; message: string } {
  return { code, message: message ?? ERROR_CATALOG[code].message };
}

export const unauthorized = (
  code: ApiErrorCode = 'AUTH_UNAUTHENTICATED',
  message?: string,
): HttpException => new UnauthorizedException(payload(code, message));

export const forbidden = (
  code: ApiErrorCode = 'FORBIDDEN',
  message?: string,
): HttpException => new ForbiddenException(payload(code, message));

export const notFound = (
  code: ApiErrorCode = 'NOT_FOUND',
  message?: string,
): HttpException => new NotFoundException(payload(code, message));

export const conflict = (
  code: ApiErrorCode = 'CONFLICT',
  message?: string,
): HttpException => new ConflictException(payload(code, message));

export const badRequest = (
  code: ApiErrorCode = 'VALIDATION_ERROR',
  message?: string,
): HttpException => new BadRequestException(payload(code, message));

export const serviceUnavailable = (
  code: ApiErrorCode = 'SERVICE_UNAVAILABLE',
  message?: string,
): HttpException => new ServiceUnavailableException(payload(code, message));
