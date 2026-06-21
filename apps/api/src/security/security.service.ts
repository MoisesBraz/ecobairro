import { Inject, Injectable, Logger } from '@nestjs/common';
import { SecurityEventType } from '@prisma/client';
import { readNumberEnv } from '@ecobairro/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface RequestContext {
  ipAddress: string;
  userAgent: string | null;
}

const MAX_FAILED_ATTEMPTS = readNumberEnv('ACCOUNT_LOCK_MAX_ATTEMPTS', 10);
const LOCK_MINUTES = readNumberEnv('ACCOUNT_LOCK_MINUTES', 15);
const ACCESS_TTL_SECONDS = readNumberEnv('JWT_ACCESS_TTL_MINUTES', 15) * 60;

/**
 * Núcleo de segurança: audit trail (SecurityLog), bloqueio de conta
 * (account lockout), e revogação imediata via Redis blacklist.
 */
@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly prisma: PrismaService;
  private readonly redis: RedisService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(RedisService) redis: RedisService,
  ) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /** Grava um evento de segurança no audit trail. Nunca lança (best-effort). */
  async log(
    userId: string,
    event: SecurityEventType,
    ctx: RequestContext,
  ): Promise<void> {
    try {
      await this.prisma.securityLog.create({
        data: {
          userId,
          event,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao gravar SecurityLog (${event}): ${String(err)}`);
    }
  }

  /** Retorna os minutos restantes se o IP estiver bloqueado, ou 0 se não estiver. */
  async isLocked(ipAddress: string): Promise<number> {
    const key = failedIpKey(ipAddress);
    const client = this.redis.getClient();
    const attempts = await client.get(key);

    if (attempts != null && parseInt(attempts, 10) >= MAX_FAILED_ATTEMPTS) {
      const ttl = await client.ttl(key);
      return Math.max(1, Math.ceil(ttl / 60));
    }
    return 0;
  }

  /**
   * Regista uma tentativa de login falhada por IP.
   * Ao chegar a MAX_FAILED_ATTEMPTS, bloqueia por LOCK_MINUTES.
   * Retorna justLocked se bloqueou exatamente agora.
   */
  async registerFailedAttempt(ipAddress: string): Promise<{ justLocked: boolean }> {
    const key = failedIpKey(ipAddress);
    const client = this.redis.getClient();

    const attempts = await client.incr(key);

    // Define a expiração na 1ª tentativa e (re)arma a janela ao bloquear.
    if (attempts === 1 || attempts === MAX_FAILED_ATTEMPTS) {
      await client.expire(key, LOCK_MINUTES * 60);
    }

    return { justLocked: attempts === MAX_FAILED_ATTEMPTS };
  }

  /** Reset do contador de falhas do IP após login bem-sucedido. */
  async resetFailedAttempts(ipAddress: string): Promise<void> {
    await this.redis.getClient().del(failedIpKey(ipAddress));
  }

  /** Marca um utilizador como revogado no Redis (kick imediato). */
  async revokeUser(userId: string): Promise<void> {
    await this.redis
      .getClient()
      .set(revokedUserKey(userId), '1', 'EX', ACCESS_TTL_SECONDS);
  }

  /** Remove a marca de revogação (ex.: ao re-autenticar). */
  async clearRevocation(userId: string): Promise<void> {
    await this.redis.getClient().del(revokedUserKey(userId));
  }

  /** Leitura ultra-rápida usada pelo guard em cada request. */
  async isRevoked(userId: string): Promise<boolean> {
    const v = await this.redis.getClient().get(revokedUserKey(userId));
    return v != null;
  }

  /**
   * Revoga uma sessão específica (por sessionId). O guard verifica esta
   * chave em cada request, pelo que o access token dessa sessão deixa de
   * funcionar imediatamente (TTL = vida do access token).
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.redis
      .getClient()
      .set(revokedSessionKey(sessionId), '1', 'EX', ACCESS_TTL_SECONDS);
  }

  /** Leitura usada pelo guard: a sessão (sid) foi revogada? */
  async isSessionRevoked(sessionId: string): Promise<boolean> {
    const v = await this.redis.getClient().get(revokedSessionKey(sessionId));
    return v != null;
  }

  /**
   * Deteta se o par (ip, userAgent) é novo para este utilizador
   * (não existe nos SecurityLog de LOGIN_SUCCESS anteriores).
   */
  async isNewDevice(userId: string, ctx: RequestContext): Promise<boolean> {
    const previous = await this.prisma.securityLog.findFirst({
      where: {
        userId,
        event: SecurityEventType.LOGIN_SUCCESS,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      select: { id: true },
    });
    return previous == null;
  }

  /** Histórico de eventos de segurança do utilizador (paginado). */
  async listLogs(userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.securityLog.findMany({
        where: { userId },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.securityLog.count({ where: { userId } }),
    ]);
    return { rows, total };
  }
}

function revokedUserKey(userId: string): string {
  return `revoked_user:${userId}`;
}

function revokedSessionKey(sessionId: string): string {
  return `revoked_session:${sessionId}`;
}

function failedIpKey(ipAddress: string): string {
  return `lockout:ip:${ipAddress}`;
}
