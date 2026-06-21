import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types';

export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authUser ?? null;
  },
);
