import { Inject, Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { readNumberEnv } from '@ecobairro/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

const ISSUER = process.env.TOTP_ISSUER ?? 'ecoBairro';
const BACKUP_CODES_COUNT = 8;
const PRE_AUTH_TTL_SECONDS = readNumberEnv('TWO_FA_PRE_AUTH_TTL_MINUTES', 5) * 60;
const EMAIL_CODE_TTL_SECONDS = readNumberEnv('TWO_FA_EMAIL_TTL_MINUTES', 5) * 60;
const BCRYPT_ROUNDS = readNumberEnv('BCRYPT_ROUNDS', 12);

const TOTP_CODE_LENGTH = 6;
const TOTP_EMAIL_CODE_MAX = 1_000_000; // 6 dígitos: 000000-999999
const QR_CODE_WIDTH_PX = 220;
const PRE_AUTH_GRACE_SECONDS = 30; // Evita double-click / React StrictMode

/**
 * Núcleo do 2FA: gera secrets TOTP, QR codes, verifica tokens
 * (incluindo backup codes), e gere o pre-auth token (login 2-step)
 * armazenado em Redis.
 */
@Injectable()
export class TwoFactorService {
  private readonly prisma: PrismaService;
  private readonly redis: RedisService;
  private readonly mail: MailService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(RedisService) redis: RedisService,
    @Inject(MailService) mail: MailService,
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.mail = mail;
  }

  /** Gera um secret TOTP base32 e o respectivo QR code (data URL). */
  async generateSetup(
    userId: string,
    email: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: ISSUER,
      label: `${ISSUER}:${email}`,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: QR_CODE_WIDTH_PX,
    });

    // Guardar o secret em modo "pending" no Redis — não persistimos
    // em User até que o utilizador prove que conseguiu importar para o app.
    await this.redis
      .getClient()
      .set(pendingSecretKey(userId), secret, 'EX', PRE_AUTH_TTL_SECONDS);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Verifica um código TOTP contra um secret (tolerância ±30s para drift de relógio). */
  verifyToken(token: string, secret: string): boolean {
    try {
      const result = verifySync({ token, secret, epochTolerance: 30 });
      return result.valid;
    } catch {
      return false;
    }
  }

  /**
   * Confirma o setup: valida o código contra o secret pending,
   * gera backup codes, persiste no User. Devolve os backup codes
   * em plaintext (única vez que aparecem ao utilizador).
   */
  async enable(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] } | null> {
    const secret = await this.redis.getClient().get(pendingSecretKey(userId));
    if (!secret) return null;

    if (!this.verifyToken(code, secret)) return null;

    const backupCodes = generateBackupCodes(BACKUP_CODES_COUNT);
    const hashed = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorType: 'TOTP_APP',
        twoFactorSecret: secret,
        backupCodes: hashed,
      },
    });

    await this.redis.getClient().del(pendingSecretKey(userId));

    return { backupCodes };
  }

  /** Desativa o 2FA do utilizador (limpa secret + backup codes). */
  async disable(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorType: 'NONE',
        twoFactorSecret: null,
        backupCodes: [],
      },
    });
  }

  /**
   * Verifica um código no fluxo de login. Conforme o tipo de 2FA do
   * utilizador aceita um código TOTP (app) ou um código enviado por email;
   * em ambos os casos aceita também um backup code (one-time).
   */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorType: true, backupCodes: true },
    });
    if (!user) return false;

    if (user.twoFactorType === 'EMAIL') {
      if (await this.verifyEmailCode(userId, code)) return true;
      return this.consumeBackupCode(userId, code, user.backupCodes ?? []);
    }

    // TOTP_APP (6 dígitos)
    if (
      user.twoFactorSecret &&
      code.length === TOTP_CODE_LENGTH &&
      /^\d+$/.test(code) &&
      this.verifyToken(code, user.twoFactorSecret)
    ) {
      return true;
    }

    return this.consumeBackupCode(userId, code, user.backupCodes ?? []);
  }

  /** Compara o código com o que foi enviado por email (constante no tempo). */
  private async verifyEmailCode(userId: string, code: string): Promise<boolean> {
    if (!(code.length === TOTP_CODE_LENGTH && /^\d+$/.test(code))) return false;
    const stored = await this.redis.getClient().get(emailCodeKey(userId));
    if (!stored) return false;
    const a = Buffer.from(stored);
    const b = Buffer.from(code);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    await this.redis.getClient().del(emailCodeKey(userId));
    return true;
  }

  /** Testa o código contra cada backup code (bcrypt); remove-o ao acertar. */
  private async consumeBackupCode(
    userId: string,
    code: string,
    backupCodes: string[],
  ): Promise<boolean> {
    for (let i = 0; i < backupCodes.length; i++) {
      const hash = backupCodes[i];
      if (!hash) continue;
      const ok = await bcrypt.compare(code, hash);
      if (ok) {
        const remaining = [...backupCodes.slice(0, i), ...backupCodes.slice(i + 1)];
        await this.prisma.user.update({
          where: { id: userId },
          data: { backupCodes: remaining },
        });
        return true;
      }
    }
    return false;
  }

  // ─── 2FA por email ────────────────────────────────────────────────────────

  /** Gera um código de 6 dígitos (TTL 5 min) e envia-o por email. */
  async sendEmailCode(userId: string, email: string): Promise<void> {
    const code = String(randomInt(0, TOTP_EMAIL_CODE_MAX)).padStart(TOTP_CODE_LENGTH, '0');
    await this.redis
      .getClient()
      .set(emailCodeKey(userId), code, 'EX', EMAIL_CODE_TTL_SECONDS);
    await this.mail.send('two-factor-code', {
      to: email,
      subject: 'ecoBairro — Código de verificação',
      variables: {
        code,
        expiresMinutes: Math.floor(EMAIL_CODE_TTL_SECONDS / 60),
      },
    });
  }

  /** Confirma o setup de 2FA por email com o código recebido; gera backup codes. */
  async enableEmail(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] } | null> {
    if (!(await this.verifyEmailCode(userId, code))) return null;

    const backupCodes = generateBackupCodes(BACKUP_CODES_COUNT);
    const hashed = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorType: 'EMAIL',
        twoFactorSecret: null,
        backupCodes: hashed,
      },
    });

    return { backupCodes };
  }

  /** Regenera os 8 backup codes (invalida os anteriores). */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const codes = generateBackupCodes(BACKUP_CODES_COUNT);
    const hashed = await Promise.all(
      codes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { backupCodes: hashed },
    });
    return codes;
  }

  /** Quantos backup codes restam (sem revelar quais). */
  async backupCodesRemaining(userId: string): Promise<number> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { backupCodes: true },
    });
    return u?.backupCodes.length ?? 0;
  }

  // ─── Pre-auth token (login 2-step) ────────────────────────────────────────

  /** Gera um token opaco de 5 min que prova "passou a fase 1 do login". */
  async issuePreAuthToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.redis
      .getClient()
      .set(preAuthKey(raw), userId, 'EX', PRE_AUTH_TTL_SECONDS);
    return raw;
  }

  /** Consome o pre-auth token (one-time use). */
  async consumePreAuthToken(token: string): Promise<string | null> {
    if (!token) return null;
    const key = preAuthKey(token);
    const client = this.redis.getClient();
    const userId = await client.get(key);
    if (!userId) return null;
    // Evita que o Strict Mode do React ou double-clicks partam o login.
    await client.expire(key, PRE_AUTH_GRACE_SECONDS);
    return userId;
  }
}

function generateBackupCodes(count: number): string[] {
  // 10 caracteres alfanuméricos maiúsculos, sem 0/O/1/I para legibilidade
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(10);
    let s = '';
    for (let j = 0; j < 10; j++) {
      const byte = bytes[j] ?? 0;
      s += alphabet[byte % alphabet.length];
    }
    // Formato XXXXX-XXXXX para facilitar a leitura
    out.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return out;
}

function pendingSecretKey(userId: string): string {
  return `2fa:pending:${userId}`;
}

function emailCodeKey(userId: string): string {
  return `2fa:email:${userId}`;
}

function preAuthKey(token: string): string {
  // Guarda hash do token no Redis para que um snapshot não revele tokens
  const h = createHash('sha256').update(token).digest('hex');
  return `2fa:preauth:${h}`;
}
