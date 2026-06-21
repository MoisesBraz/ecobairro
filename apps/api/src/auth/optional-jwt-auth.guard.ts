import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedRequest, JwtPayload } from './auth.types';

/**
 * Validates Bearer JWT when present and attaches `authUser`; otherwise leaves anonymous.
 * Invalid or expired tokens are ignored (request stays anonymous).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly jwtService: JwtService;

  constructor(@Inject(JwtService) jwtService: JwtService) {
    this.jwtService = jwtService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.authUser = {
        userId: payload.sub,
        role: payload.role,
      };
    } catch {
      // Token inválido ou expirado: tratar como visitante.
    }

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.header('authorization');

    if (!header) {
      return null;
    }

    const [scheme, value] = header.split(' ');

    if (scheme !== 'Bearer' || !value) {
      return null;
    }

    return value;
  }
}
