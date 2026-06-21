import assert from 'node:assert/strict';
import type { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../../src/auth/optional-jwt-auth.guard';
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

export const optionalJwtAuthGuardTests: TestCase[] = [
  {
    name: 'allows anonymous requests without authorization header',
    run: async () => {
      const request = buildRequest(null);
      const guard = new OptionalJwtAuthGuard(new FakeJwtService(null) as never);

      const result = await guard.canActivate(buildExecutionContext(request));

      assert.equal(result, true);
      assert.equal(request.authUser, undefined);
    },
  },
  {
    name: 'attaches authUser when bearer token is valid',
    run: async () => {
      const request = buildRequest('Bearer valid-token');
      const guard = new OptionalJwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
        }) as never,
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
    name: 'ignores invalid bearer tokens and stays anonymous',
    run: async () => {
      const request = buildRequest('Bearer invalid-token');
      const guard = new OptionalJwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
        }) as never,
      );

      const result = await guard.canActivate(buildExecutionContext(request));

      assert.equal(result, true);
      assert.equal(request.authUser, undefined);
    },
  },
  {
    name: 'ignores authorization header if scheme is not Bearer',
    run: async () => {
      const request = buildRequest('Basic valid-token');
      const guard = new OptionalJwtAuthGuard(
        new FakeJwtService({
          sub: 'user-1',
          role: 'CIDADAO',
        }) as never,
      );

      const result = await guard.canActivate(buildExecutionContext(request));

      assert.equal(result, true);
      assert.equal(request.authUser, undefined);
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
