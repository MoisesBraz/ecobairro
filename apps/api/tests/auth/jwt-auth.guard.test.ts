import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import type { AuthenticatedRequest, JwtPayload } from '../../src/auth/auth.types';
import type { TestCase } from '../test-helpers';

class FakeJwtService {
  constructor(private readonly payload: JwtPayload | null) {}

  async verifyAsync(token: string): Promise<JwtPayload> {
    if (!this.payload || token === 'invalid-token') {
      throw new Error('invalid');
    }

    return this.payload;
  }
}

class FakeSecurityService {
  constructor(
    private readonly revoked = false,
    private readonly sessionRevoked = false,
  ) {}
  async isRevoked(): Promise<boolean> {
    return this.revoked;
  }
  async isSessionRevoked(): Promise<boolean> {
    return this.sessionRevoked;
  }
}

export const jwtAuthGuardTests: TestCase[] = [
  {
    name: 'attaches the authenticated user when the bearer token is valid',
    run: async () => {
      const request = buildRequest('Bearer valid-token');
      const guard = new JwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
        }) as never,
        new FakeSecurityService() as never,
      );

      const result = await guard.canActivate(buildExecutionContext(request));

      assert.equal(result, true);
      assert.deepEqual(request.authUser, {
        userId: 'user-1',
        role: 'CIDADAO',
      });
    },
  },
  {
    name: 'rejects requests without a bearer token',
    run: async () => {
      const guard = new JwtAuthGuard(
        new FakeJwtService(null) as never,
        new FakeSecurityService() as never,
      );

      await assert.rejects(
        () => guard.canActivate(buildExecutionContext(buildRequest(null))),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Sessão inválida ou expirada. Inicie sessão novamente.',
      );
    },
  },
  {
    name: 'rejects invalid bearer tokens',
    run: async () => {
      const guard = new JwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
        }) as never,
        new FakeSecurityService() as never,
      );

      await assert.rejects(
        () => guard.canActivate(buildExecutionContext(buildRequest('Bearer invalid-token'))),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Sessão inválida ou expirada. Inicie sessão novamente.',
      );
    },
  },
  {
    name: 'rejects if the token is revoked',
    run: async () => {
      const guard = new JwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
        }) as never,
        new FakeSecurityService(true) as never,
      );

      await assert.rejects(
        () => guard.canActivate(buildExecutionContext(buildRequest('Bearer valid-token'))),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'A sua sessão foi terminada. Inicie sessão novamente.',
      );
    },
  },
  {
    name: 'rejects if the specific session (sid) was revoked',
    run: async () => {
      const guard = new JwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
          sid: 'sess-1',
        }) as never,
        new FakeSecurityService(false, true) as never,
      );

      await assert.rejects(
        () => guard.canActivate(buildExecutionContext(buildRequest('Bearer valid-token'))),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'A sua sessão foi terminada. Inicie sessão novamente.',
      );
    },
  },
  {
    name: 'rejects if the authorization header is not a bearer token',
    run: async () => {
      const guard = new JwtAuthGuard(
        new FakeJwtService(null) as never,
        new FakeSecurityService() as never,
      );

      await assert.rejects(
        () => guard.canActivate(buildExecutionContext(buildRequest('Basic invalid-token'))),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Sessão inválida ou expirada. Inicie sessão novamente.',
      );
    },
  },
];

function buildRequest(authorizationHeader: string | null): AuthenticatedRequest {
  return {
    header(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return authorizationHeader ?? undefined;
      }

      return undefined;
    },
  } as AuthenticatedRequest;
}

function buildExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}
