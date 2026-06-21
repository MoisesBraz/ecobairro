import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SecurityEventType, UserRole } from '@prisma/client';
import { readNumberEnv } from '@ecobairro/config';
import type {
  AuthMeResponse,
  ForgotPasswordResponse,
  LoginResponse,
  RegisterResponse,
  UserRole as ContractUserRole,
} from '@ecobairro/contracts';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { GoogleLoginDto } from './dto/google-login.dto';
import { MailService } from '../mail/mail.service';
import { roleFromString } from '../users/roles.util';
import type { CreateUserRequest } from '@ecobairro/contracts';
import { SecurityService, type RequestContext } from '../security/security.service';
import { SessionService } from '../security/session.service';
import { AuditService } from '../audit/audit.service';
import { TwoFactorService } from './two-factor.service';
import { conflict, forbidden, unauthorized } from '../common/errors';
import type { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';

interface StoredSession {
  refreshTokenHash: string;
}

@Injectable()
export class AuthService {
  private readonly prisma: PrismaService;
  private readonly redisService: RedisService;
  private readonly jwtService: JwtService;
  private readonly refreshTokenTtlSeconds =
    readNumberEnv('REFRESH_TOKEN_TTL_DAYS', 7) * 24 * 60 * 60;
  private readonly bcryptRounds = readNumberEnv('BCRYPT_ROUNDS', 12);
  private readonly resetPasswordTtlSeconds =
    readNumberEnv('PASSWORD_RESET_TTL_MINUTES', 30) * 60;
  private readonly appBaseUrl = (process.env.APP_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
  private readonly returnResetToken =
    (process.env.PASSWORD_RESET_RETURN_TOKEN ?? 'false') === 'true';
  private readonly mailService: MailService;
  private readonly securityService: SecurityService;
  private readonly sessionService: SessionService;
  private readonly auditService: AuditService;
  private readonly twoFactorService: TwoFactorService;

  /** Papéis de staff cujo login/logout interessa registar na auditoria. */
  private static readonly STAFF_ROLES: ReadonlySet<UserRole> = new Set([
    UserRole.OPERADOR,
    UserRole.GESTOR,
    UserRole.ADMIN,
  ]);

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(RedisService) redisService: RedisService,
    @Inject(JwtService) jwtService: JwtService,
    @Inject(MailService) mailService: MailService,
    @Inject(SecurityService) securityService: SecurityService,
    @Inject(SessionService) sessionService: SessionService,
    @Inject(AuditService) auditService: AuditService,
    @Inject(TwoFactorService) twoFactorService: TwoFactorService,
  ) {
    this.prisma = prisma;
    this.redisService = redisService;
    this.jwtService = jwtService;
    this.mailService = mailService;
    this.securityService = securityService;
    this.sessionService = sessionService;
    this.auditService = auditService;
    this.twoFactorService = twoFactorService;
  }

  /**
   * Regista login/logout de staff (operador/gestor/admin) no AuditLog — é o que
   * alimenta a vista de auditoria do gestor. Best-effort: nunca bloqueia o auth.
   * Logins de cidadão ficam no histórico de segurança pessoal, não na auditoria.
   */
  private async auditAuthEvent(
    email: string,
    role: UserRole,
    acao: 'login' | 'logout',
    ip: string,
  ): Promise<void> {
    if (!AuthService.STAFF_ROLES.has(role)) return;
    try {
      await this.auditService.write({
        utilizador: email,
        papel: role.toLowerCase(),
        acao,
        descricao: acao === 'login' ? 'Início de sessão' : 'Fim de sessão',
        ip,
      });
    } catch {
      // Auditoria é best-effort.
    }
  }

  async register(input: RegisterDto): Promise<RegisterResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw conflict('AUTH_EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds);

    const user = await this.prisma.$transaction(async (tx) =>
      tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          phone: input.phone ?? null,
          role: UserRole.CIDADAO,
          cidadaoPerfil: {
            create: {
              rgpdAccepted: input.rgpd_accepted,
              nomeCompleto: input.nome_completo?.trim() || null,
            },
          },
        },
      }),
    );

    // Enviar email de verificação (best-effort, não bloqueia o registo)
    if (this.isPasswordEmailConfigured()) {
      this.sendEmailVerification(user.id, user.email).catch(() => undefined);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as ContractUserRole,
      email_verified: user.emailVerified,
    };
  }

  /**
   * Criação de utilizador por um administrador. Não recebe password: gera uma
   * password aleatória e envia ao utilizador um email para a definir (reutiliza
   * o fluxo de reset). Ao concluir o reset, `resetPassword` marca o email como
   * verificado, permitindo o login.
   *
   * Apenas papéis CIDADAO recebem um `cidadaoPerfil` (para guardar o nome); o
   * schema não tem campo de nome para os restantes papéis.
   */
  async adminCreateUser(input: CreateUserRequest): Promise<RegisterResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const role = roleFromString(input.role);
    if (!role) {
      throw new BadRequestException('Papel inválido.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw conflict('AUTH_EMAIL_TAKEN');
    }

    // Password aleatória — o utilizador define a sua via email de reset.
    const randomPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, this.bcryptRounds);
    const nome = input.nome?.trim() || null;

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role,
        ...(role === UserRole.CIDADAO
          ? {
              cidadaoPerfil: {
                create: {
                  rgpdAccepted: false,
                  nomeCompleto: nome,
                },
              },
            }
          : {}),
      },
    });

    // Token de definição de password (mesmo mecanismo do reset) + email.
    // Best-effort: a criação não falha se o SMTP não estiver configurado.
    const rawToken = randomBytes(24).toString('hex');
    await this.redisService
      .getClient()
      .set(
        getPasswordResetKey(rawToken),
        user.id,
        'EX',
        this.resetPasswordTtlSeconds,
      );
    await this.sendPasswordResetEmail(normalizedEmail, rawToken).catch(() => undefined);

    return {
      id: user.id,
      email: user.email,
      role: user.role as ContractUserRole,
      email_verified: user.emailVerified,
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const redis = this.redisService.getClient();
    const key = getEmailVerifyKey(token);
    const userId = await redis.get(key);

    if (!userId) {
      throw unauthorized('AUTH_INVALID_VERIFICATION');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    await redis.del(key);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailVerified: true, eliminadoEm: true },
    });

    // Não revelar se o email existe ou não
    if (!user || user.eliminadoEm || user.emailVerified) return;

    if (this.isPasswordEmailConfigured()) {
      await this.sendEmailVerification(user.id, normalizedEmail);
    }
  }

  async login(input: LoginDto, ctx: RequestContext): Promise<LoginResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.eliminadoEm) {
      throw unauthorized('AUTH_INVALID_CREDENTIALS');
    }

    // Bloqueia login se o email ainda não foi verificado
    if (!user.emailVerified) {
      throw forbidden('AUTH_EMAIL_NOT_VERIFIED');
    }

    // Lockout por IP: rejeita imediatamente sem revelar se a password é boa
    const lockoutMinutes = await this.securityService.isLocked(ctx.ipAddress);
    if (lockoutMinutes > 0) {
      throw forbidden(
        'AUTH_ACCOUNT_LOCKED',
        `Conta bloqueada temporariamente. Tente novamente em ${lockoutMinutes} minutos.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.securityService.log(user.id, SecurityEventType.LOGIN_FAILED, ctx);
      const { justLocked } = await this.securityService.registerFailedAttempt(ctx.ipAddress);
      if (justLocked) {
        await this.securityService.log(user.id, SecurityEventType.ACCOUNT_LOCKED, ctx);
        await this.sendAccountLockedEmail(user.email).catch(() => undefined);
      }
      throw unauthorized('AUTH_INVALID_CREDENTIALS');
    }

    // Login ok: audit + clear lockout + detectar novo dispositivo
    const newDevice = await this.securityService.isNewDevice(user.id, ctx);
    await this.securityService.resetFailedAttempts(ctx.ipAddress);
    await this.securityService.log(user.id, SecurityEventType.LOGIN_SUCCESS, ctx);
    await this.securityService.clearRevocation(user.id);

    if (newDevice) {
      await this.sendNewDeviceEmail(user.email, ctx).catch(() => undefined);
    }

    // 2FA: emite pre-auth token e devolve requires_2fa = true
    if (user.twoFactorEnabled) {
      // 2FA por email: envia o código de 6 dígitos para a caixa do utilizador.
      if (user.twoFactorType === 'EMAIL') {
        await this.twoFactorService.sendEmailCode(user.id, user.email);
      }
      const preAuthToken = await this.twoFactorService.issuePreAuthToken(user.id);
      return {
        access_token: '',
        refresh_token: '',
        requires_2fa: true,
        pre_auth_token: preAuthToken,
      };
    }

    await this.auditAuthEvent(user.email, user.role, 'login', ctx.ipAddress);
    return this.issueSession(user.id, user.role as ContractUserRole, ctx);
  }

  async googleLogin(input: GoogleLoginDto, ctx: RequestContext): Promise<LoginResponse> {
    // 1. Validar se o token pertence à nossa aplicação (Prevenir Confused Deputy Attack)
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${input.token}`);
    if (!tokenInfoRes.ok) {
      throw unauthorized('AUTH_INVALID_GOOGLE_TOKEN');
    }
    const tokenInfo = await tokenInfoRes.json() as { aud?: string };
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    
    if (expectedClientId && tokenInfo.aud !== expectedClientId) {
      throw unauthorized('AUTH_INVALID_GOOGLE_CLIENT');
    }

    // 2. Obter dados do utilizador
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${input.token}` },
    });

    if (!userInfoRes.ok) {
      throw unauthorized('AUTH_INVALID_GOOGLE_TOKEN');
    }

    const profile = await userInfoRes.json() as { email: string; given_name?: string; family_name?: string; email_verified?: boolean };
    const normalizedEmail = profile.email.trim().toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, this.bcryptRounds);

      user = await this.prisma.$transaction(async (tx) =>
        tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            emailVerified: true,
            role: UserRole.CIDADAO,
            cidadaoPerfil: {
              create: {
                rgpdAccepted: true,
                nomeCompleto: [profile.given_name, profile.family_name].filter(Boolean).join(' ') || null,
              },
            },
          },
        }),
      );
    } else if (user.eliminadoEm) {
      throw unauthorized('AUTH_INVALID_CREDENTIALS');
    }

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true }
      });
    }

    const newDevice = await this.securityService.isNewDevice(user.id, ctx);
    await this.securityService.log(user.id, SecurityEventType.LOGIN_SUCCESS, ctx);
    await this.securityService.clearRevocation(user.id);

    if (newDevice) {
      await this.sendNewDeviceEmail(user.email, ctx).catch(() => undefined);
    }

    if (user.twoFactorEnabled) {
      const preAuthToken = await this.twoFactorService.issuePreAuthToken(user.id);
      return {
        access_token: '',
        refresh_token: '',
        requires_2fa: true,
        pre_auth_token: preAuthToken,
      };
    }

    await this.auditAuthEvent(user.email, user.role, 'login', ctx.ipAddress);
    return this.issueSession(user.id, user.role as ContractUserRole, ctx);
  }

  /**
   * Segundo passo do login: consome o pre-auth token + verifica o
   * código TOTP (ou backup code). Devolve sessão completa.
   */
  async verifyTwoFactor(
    input: VerifyTwoFactorDto,
    ctx: RequestContext,
  ): Promise<LoginResponse> {
    const userId = await this.twoFactorService.consumePreAuthToken(
      input.pre_auth_token,
    );
    if (!userId) {
      throw unauthorized('AUTH_2FA_EXPIRED');
    }

    const ok = await this.twoFactorService.verifyLoginCode(userId, input.code);
    if (!ok) {
      await this.securityService.log(userId, SecurityEventType.LOGIN_FAILED, ctx);
      throw unauthorized('AUTH_2FA_INVALID');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, eliminadoEm: true },
    });
    const lockoutMinutes = await this.securityService.isLocked(ctx.ipAddress);
    if (!user || user.eliminadoEm || lockoutMinutes > 0) {
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    await this.securityService.log(userId, SecurityEventType.LOGIN_SUCCESS, ctx);
    await this.auditAuthEvent(user.email, user.role, 'login', ctx.ipAddress);
    return this.issueSession(user.id, user.role as ContractUserRole, ctx);
  }

  async refresh(input: RefreshDto, ctx: RequestContext): Promise<LoginResponse> {
    if (!input.refresh_token) {
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }
    const rotated = await this.sessionService.rotate(input.refresh_token);
    if (!rotated) {
      // Reuse detection: token usado/inexistente → revoga toda a cadeia
      const possibleUserId = extractUserIdFromRefreshToken(input.refresh_token);
      if (possibleUserId) {
        await this.sessionService.revokeAll(possibleUserId);
        await this.securityService.revokeUser(possibleUserId);
        await this.securityService
          .log(possibleUserId, SecurityEventType.DEVICE_REVOKED, ctx)
          .catch(() => undefined);
      }
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: { id: true, role: true, eliminadoEm: true },
    });

    const lockoutMinutes = await this.securityService.isLocked(ctx.ipAddress);
    if (!user || user.eliminadoEm || lockoutMinutes > 0) {
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    return this.issueSession(user.id, user.role as ContractUserRole, ctx);
  }

  async logout(userId: string, ctx?: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });
    await this.sessionService.revokeAll(userId);
    await this.securityService.revokeUser(userId);
    // Compat com o fluxo antigo (1 sessão por user em Redis)
    await this.redisService.getClient().del(getUserSessionKey(userId));
    if (user) {
      await this.auditAuthEvent(
        user.email,
        user.role,
        'logout',
        ctx?.ipAddress ?? '0.0.0.0',
      );
    }
  }

  async me(userId: string): Promise<AuthMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        eliminadoEm: true,
      },
    });

    if (!user || user.eliminadoEm) {
      throw unauthorized('AUTH_UNAUTHENTICATED');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as ContractUserRole,
      email_verified: user.emailVerified,
    };
  }

  async forgotPassword(input: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, eliminadoEm: true },
    });

    if (!user || user.eliminadoEm) {
      return { ok: true };
    }

    const rawToken = randomBytes(24).toString('hex');
    await this.redisService
      .getClient()
      .set(
        getPasswordResetKey(rawToken),
        user.id,
        'EX',
        this.resetPasswordTtlSeconds,
      );

    const smtpConfigured = this.isPasswordEmailConfigured();

    if (smtpConfigured && process.env.NODE_ENV !== 'test') {
      await this.sendPasswordResetEmail(normalizedEmail, rawToken);
    }

    if (
      process.env.NODE_ENV === 'test' ||
      this.returnResetToken ||
      (!smtpConfigured && process.env.NODE_ENV !== 'production')
    ) {
      return { ok: true, reset_token: rawToken };
    }

    return { ok: true };
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const resetKey = getPasswordResetKey(input.token);
    const redis = this.redisService.getClient();
    const userId = await redis.get(resetKey);

    if (!userId) {
      throw unauthorized('AUTH_INVALID_RESET_TOKEN');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, eliminadoEm: true },
    });

    if (!user || user.eliminadoEm) {
      await redis.del(resetKey);
      throw unauthorized('AUTH_INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(input.new_password, this.bcryptRounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        emailVerified: true,
      },
    });

    await Promise.all([
      redis.del(resetKey),
      redis.del(getUserSessionKey(userId)),
      this.sessionService.revokeAll(userId),
      this.securityService.revokeUser(userId),
      this.securityService
        .log(userId, SecurityEventType.PASSWORD_CHANGED, {
          ipAddress: 'reset-flow',
          userAgent: null,
        })
        .catch(() => undefined),
    ]);
  }

  private async issueSession(
    userId: string,
    role: ContractUserRole,
    ctx: RequestContext,
  ): Promise<LoginResponse> {
    const refreshToken = `${userId}.${randomBytes(32).toString('hex')}`;

    // Persistir ActiveSession (multi-sessão por user, suporta revogação remota).
    // O id da sessão vai no access token (sid) para permitir revogação imediata.
    const sessionId = await this.sessionService.create(userId, refreshToken, ctx);

    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      role,
      sid: sessionId,
    } satisfies JwtPayload);

    // Compat: continuar a guardar a "última sessão" em Redis para fluxos legacy
    const session: StoredSession = { refreshTokenHash: hashToken(refreshToken) };
    await this.redisService
      .getClient()
      .set(
        getUserSessionKey(userId),
        JSON.stringify(session),
        'EX',
        this.refreshTokenTtlSeconds,
      );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      requires_2fa: false,
      pre_auth_token: null,
    };
  }

  private async sendAccountLockedEmail(email: string): Promise<void> {
    if (!this.isPasswordEmailConfigured()) return;
    await this.mailService.send('account-locked', {
      to: email,
      subject: 'ecoBairro — Conta bloqueada temporariamente',
      variables: { minutes: 30 },
    });
  }

  private async sendNewDeviceEmail(email: string, ctx: RequestContext): Promise<void> {
    if (!this.isPasswordEmailConfigured()) return;
    await this.mailService.send('new-device-login', {
      to: email,
      subject: 'ecoBairro — Novo dispositivo detectado',
      variables: {
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent ?? 'desconhecido',
        dateTime: new Date().toISOString(),
      },
    });
  }

  private isPasswordEmailConfigured(): boolean {
    return !!process.env.SMTP_HOST?.trim();
  }

  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(24).toString('hex');
    const ttlSeconds = 24 * 60 * 60; // 24 horas
    await this.redisService
      .getClient()
      .set(getEmailVerifyKey(rawToken), userId, 'EX', ttlSeconds);

    const verifyUrl = `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
    await this.mailService.send('email-verification', {
      to: email,
      subject: 'ecoBairro — Confirme o seu email',
      variables: {
        verifyUrl,
        expiresHours: 24,
      },
    });
  }

  private async sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
    if (!this.isPasswordEmailConfigured()) {
      throw new ServiceUnavailableException(
        'Password recovery email service is not configured',
      );
    }
    const resetUrl = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await this.mailService.send('password-reset', {
      to: email,
      subject: 'ecoBairro — Recuperação de password',
      variables: {
        resetUrl,
        expiresMinutes: Math.floor(this.resetPasswordTtlSeconds / 60),
      },
    });
  }
}

function getUserSessionKey(userId: string): string {
  return `user:session:${userId}`;
}

function extractUserIdFromRefreshToken(token: string): string | null {
  const [userId, randomPart] = token.split('.');

  if (!userId || !randomPart) {
    return null;
  }

  return userId;
}

function getPasswordResetKey(rawToken: string): string {
  return `user:reset:${hashToken(rawToken)}`;
}

function getEmailVerifyKey(rawToken: string): string {
  return `user:verify:${hashToken(rawToken)}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
