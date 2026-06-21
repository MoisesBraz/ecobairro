import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiErrorResponse } from '@ecobairro/contracts';
import { HttpExceptionFilter } from '../../src/common/errors/http-exception.filter';
import { forbidden, notFound } from '../../src/common/errors';
import type { TestCase } from '../test-helpers';

interface Captured {
  status: number;
  body: ApiErrorResponse | null;
}

/** Corre o filtro sobre uma exceção e captura o que seria enviado na resposta. */
function runFilter(exception: unknown): Captured {
  const captured: Captured = { status: 0, body: null };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: ApiErrorResponse) {
      captured.body = payload;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  };
  new HttpExceptionFilter().catch(exception, host as never);
  return captured;
}

export const httpExceptionFilterTests: TestCase[] = [
  {
    name: 'helper exception keeps code and friendly message',
    run: () => {
      const { status, body } = runFilter(forbidden('FORBIDDEN'));
      assert.equal(status, 403);
      assert.equal(body?.code, 'FORBIDDEN');
      assert.equal(body?.message, 'Não tem permissão para esta acção.');
    },
  },
  {
    name: 'specific not-found code maps to its catalog message',
    run: () => {
      const { status, body } = runFilter(notFound('REPORT_NOT_FOUND'));
      assert.equal(status, 404);
      assert.equal(body?.code, 'REPORT_NOT_FOUND');
      assert.equal(body?.message, 'Reporte não encontrado.');
    },
  },
  {
    name: 'native exception without message falls back to catalog (no English leak)',
    run: () => {
      const { status, body } = runFilter(new UnauthorizedException());
      assert.equal(status, 401);
      assert.equal(body?.code, 'AUTH_UNAUTHENTICATED');
      assert.equal(body?.message, 'Sessão inválida ou expirada. Inicie sessão novamente.');
    },
  },
  {
    name: 'native exception with PT message preserves the message',
    run: () => {
      const { body } = runFilter(new ConflictException('Mensagem específica em PT.'));
      assert.equal(body?.code, 'CONFLICT');
      assert.equal(body?.message, 'Mensagem específica em PT.');
    },
  },
  {
    name: 'validation errors become details + friendly message',
    run: () => {
      const { status, body } = runFilter(
        new BadRequestException({
          statusCode: 400,
          message: ['email must be an email', 'password should not be empty'],
          error: 'Bad Request',
        }),
      );
      assert.equal(status, 400);
      assert.equal(body?.code, 'VALIDATION_ERROR');
      assert.equal(body?.message, 'Dados inválidos. Verifique os campos e tente novamente.');
      assert.equal(body?.details?.length, 2);
    },
  },
  {
    name: '5xx HttpException never leaks the original message',
    run: () => {
      const { status, body } = runFilter(new InternalServerErrorException('detalhe interno secreto'));
      assert.equal(status, 500);
      assert.equal(body?.code, 'INTERNAL');
      assert.equal(body?.message, 'Serviço indisponível neste momento. Tente novamente daqui a pouco.');
    },
  },
  {
    name: 'unknown (non-HTTP) error returns a generic 500',
    run: () => {
      const { status, body } = runFilter(new Error('boom'));
      assert.equal(status, 500);
      assert.equal(body?.code, 'INTERNAL');
      assert.equal(body?.message, 'Serviço indisponível neste momento. Tente novamente daqui a pouco.');
    },
  },
];
