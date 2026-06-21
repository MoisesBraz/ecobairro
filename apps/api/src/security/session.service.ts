import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { readNumberEnv } from '@ecobairro/config';
import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from './security.service';

const REFRESH_TTL_DAYS = readNumberEnv('REFRESH_TOKEN_TTL_DAYS', 7);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Gestão de sessões ativas persistidas (tabela ActiveSession).
 * Suporta listagem para a UI de "Segurança", revogação remota e
 * rotação de refresh tokens.
 */
@Injectable()
export class SessionService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /** Cria uma sessão ativa (guarda o hash do refresh token). */
  async create(
    userId: string,
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<string> {
    const session = await this.prisma.activeSession.create({
      data: {
        userId,
        refreshToken: hashToken(refreshToken),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * MS_PER_DAY),
      },
      select: { id: true },
    });
    return session.id;
  }

  /**
   * Rotação: valida o refresh token contra a sessão existente, apaga-a
   * e devolve o userId. Se o token não existir (reutilização), devolve null
   * — o chamador deve revogar toda a cadeia do utilizador.
   */
  async rotate(refreshToken: string): Promise<{ userId: string } | null> {
    const hash = hashToken(refreshToken);
    const session = await this.prisma.activeSession.findUnique({
      where: { refreshToken: hash },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session) return null;

    await this.prisma.activeSession.delete({ where: { id: session.id } });

    if (session.expiresAt.getTime() < Date.now()) return null;

    return { userId: session.userId };
  }

  /** Lista sessões ativas (não expiradas) de um utilizador. */
  async list(userId: string) {
    return this.prisma.activeSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        criadoEm: true,
        expiresAt: true,
      },
    });
  }

  /** Revoga uma sessão específica (pertencente ao utilizador). */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.activeSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return result.count > 0;
  }

  /** Revoga todas as sessões de um utilizador (logout global / lock). */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.activeSession.deleteMany({ where: { userId } });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
