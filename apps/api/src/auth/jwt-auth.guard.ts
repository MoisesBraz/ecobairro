import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedRequest, JwtPayload } from './auth.types';
import { SecurityService } from '../security/security.service';
import { unauthorized } from '../common/errors';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly securityService: SecurityService;

  constructor(
    @Inject(JwtService) jwtService: JwtService,
    @Inject(SecurityService) securityService: SecurityService,
  ) {
    this.jwtService = jwtService;
    this.securityService = securityService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw unauthorized('AUTH_UNAUTHENTICATED');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw unauthorized('AUTH_UNAUTHENTICATED');
    }

    // Revogação imediata: se o utilizador foi bloqueado/eliminado/kicked,
    // existe uma chave revoked_user:{id} no Redis (TTL = vida do access token).
    // Leitura ultra-rápida em cada request.
    if (await this.securityService.isRevoked(payload.sub)) {
      throw unauthorized('AUTH_SESSION_REVOKED');
    }

    // Revogação por sessão: se esta sessão específica (sid) foi terminada,
    // o access token deixa de valer de imediato, mesmo antes de expirar.
    if (payload.sid && (await this.securityService.isSessionRevoked(payload.sid))) {
      throw unauthorized('AUTH_SESSION_REVOKED');
    }

    request.authUser = {
      userId: payload.sub,
      role: payload.role,
      ...(payload.sid ? { sessionId: payload.sid } : {}),
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.header('authorization');

    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
