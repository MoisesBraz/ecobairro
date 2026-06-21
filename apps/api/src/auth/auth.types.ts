import type { Request } from 'express';
import type { UserRole } from '@ecobairro/contracts';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  /** ActiveSession.id — permite revogação imediata por sessão. */
  sid?: string;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}
