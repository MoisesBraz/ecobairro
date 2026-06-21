import assert from 'node:assert/strict';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import type { TestCase } from '../test-helpers';
import { RegisterDto } from '../../src/auth/dto/register.dto';

class FakeMailService {
  readonly sent: Array<{ template: string; to: string }> = [];
  async send(template: string, options: { to: string }): Promise<void> {
    this.sent.push({ template, to: options.to });
  }
}

class FakeSecurityService {
  readonly logs: Array<{ userId: string; event: string }> = [];
  readonly revoked = new Set<string>();
  private failedAttempts = new Map<string, number>();

  async isLocked(ipAddress: string): Promise<number> {
    const attempts = this.failedAttempts.get(ipAddress) ?? 0;
    return attempts >= 5 ? 15 : 0;
  }
  async log(userId: string, event: string): Promise<void> {
    this.logs.push({ userId, event });
  }
  async registerFailedAttempt(ipAddress: string): Promise<{ justLocked: boolean }> {
    const n = (this.failedAttempts.get(ipAddress) ?? 0) + 1;
    this.failedAttempts.set(ipAddress, n);
    return { justLocked: n === 5 };
  }
  async resetFailedAttempts(ipAddress: string): Promise<void> {
    this.failedAttempts.delete(ipAddress);
  }
  async revokeUser(userId: string): Promise<void> { this.revoked.add(userId); }
  async clearRevocation(userId: string): Promise<void> { this.revoked.delete(userId); }
  async isRevoked(userId: string): Promise<boolean> { return this.revoked.has(userId); }
  async isNewDevice(): Promise<boolean> { return false; }
}

class FakeSessionService {
  readonly created: Array<{ userId: string; refreshToken: string }> = [];
  private sessions = new Map<string, string>(); // refreshToken → userId

  async create(userId: string, refreshToken: string): Promise<string> {
    this.created.push({ userId, refreshToken });
    this.sessions.set(refreshToken, userId);
    return 'session-' + this.created.length;
  }
  async rotate(refreshToken: string): Promise<{ userId: string } | null> {
    const userId = this.sessions.get(refreshToken);
    if (!userId) return null;
    this.sessions.delete(refreshToken);
    return { userId };
  }
  async revokeAll(userId: string): Promise<void> {
    for (const [t, uid] of this.sessions.entries()) {
      if (uid === userId) this.sessions.delete(t);
    }
  }
}

class FakeAuditService {
  readonly writes: Array<Record<string, unknown>> = [];
  async write(data: Record<string, unknown>): Promise<void> {
    this.writes.push(data);
  }
}

class FakeTwoFactorService {
  async issuePreAuthToken(): Promise<string> { return 'fake-pre-auth'; }
  async consumePreAuthToken(): Promise<string | null> { return null; }
  async verifyLoginCode(): Promise<boolean> { return false; }
  async enable(): Promise<{ backupCodes: string[] } | null> { return null; }
  async disable(): Promise<void> {}
  async regenerateBackupCodes(): Promise<string[]> { return []; }
  async backupCodesRemaining(): Promise<number> { return 0; }
}

const FAKE_CTX = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

interface FakeUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  emailVerified: boolean;
  role: UserRole;
  eliminadoEm: Date | null;
  cidadaoPerfil: {
    rgpdAccepted: boolean;
  } | null;
}

class FakeRedisClient {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

class FakePrismaService {
  readonly users = new Map<string, FakeUserRecord>();
  readonly usersByEmail = new Map<string, FakeUserRecord>();
  private nextId = 1;

  readonly user = {
    findUnique: async (args: {
      where: { email?: string; id?: string };
      select?: Record<string, boolean>;
    }) => {
      const user = args.where.email
        ? this.usersByEmail.get(args.where.email)
        : this.users.get(args.where.id ?? '');

      if (!user) {
        return null;
      }

      if (args.select) {
        return selectFields(user, args.select);
      }

      return { ...user };
    },
    create: async (args: {
      data: {
        email: string;
        passwordHash: string;
        phone: string | null;
        role: UserRole;
        cidadaoPerfil: {
          create: {
            rgpdAccepted: boolean;
          };
        };
      };
    }) => {
      const user: FakeUserRecord = {
        id: `user-${this.nextId++}`,
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        phone: args.data.phone,
        emailVerified: false,
        role: args.data.role,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: args.data.cidadaoPerfil.create.rgpdAccepted,
        },
      };

      this.users.set(user.id, user);
      this.usersByEmail.set(user.email, user);
      return { ...user };
    },
    update: async (args: {
      where: { id: string };
      data: { passwordHash: string };
    }) => {
      const user = this.users.get(args.where.id);
      if (!user) {
        throw new Error('User not found');
      }

      user.passwordHash = args.data.passwordHash;
      return { ...user };
    },
  };

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }

  seedUser(user: FakeUserRecord): void {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }
}

class FakeRedisService {
  constructor(private readonly client: FakeRedisClient) {}

  getClient(): FakeRedisClient {
    return this.client;
  }
}

class FakeJwtService {
  private counter = 0;

  async signAsync(): Promise<string> {
    this.counter += 1;
    return `access-token-${this.counter}`;
  }
}

export const authServiceTests: TestCase[] = [
  {
    name: 'validates register phone min/max length and format',
    run: async () => {
      const invalidDto = plainToInstance(RegisterDto, {
        email: 'citizen@example.com',
        password: 'Password123!',
        phone: 'abc',
        rgpd_accepted: true,
      });

      const invalidErrors = await validate(invalidDto);
      const invalidPhone = invalidErrors.find((error) => error.property === 'phone');
      assert.ok(invalidPhone);

      const validDto = plainToInstance(RegisterDto, {
        email: 'citizen@example.com',
        password: 'Password123!',
        phone: '+351 912-345-678',
        rgpd_accepted: true,
      });

      const validErrors = await validate(validDto);
      assert.equal(validErrors.length, 0);
    },
  },
  {
    name: 'returns current user profile from me endpoint service method',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      prisma.seedUser({
        id: 'user-11',
        email: 'citizen@example.com',
        passwordHash: 'hashed',
        phone: null,
        emailVerified: true,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });

      const service = new AuthService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      const me = await service.me('user-11');
      assert.equal(me.id, 'user-11');
      assert.equal(me.email, 'citizen@example.com');
      assert.equal(me.role, 'CIDADAO');
      assert.equal(me.email_verified, true);
    },
  },
  {
    name: 'registers a citizen account and normalizes the email',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      const service = new AuthService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      const result = await service.register({
        email: 'Citizen@Example.com ',
        password: 'Password123!',
        phone: '+351910000000',
        rgpd_accepted: true,
      });

      assert.equal(result.email, 'citizen@example.com');
      assert.equal(result.role, 'CIDADAO');
      assert.equal(result.email_verified, false);

      const storedUser = prisma.usersByEmail.get('citizen@example.com');
      assert.ok(storedUser);
      assert.equal(storedUser.role, UserRole.CIDADAO);
      assert.equal(storedUser.cidadaoPerfil?.rgpdAccepted, true);
      assert.notEqual(storedUser.passwordHash, 'Password123!');
    },
  },
  {
    name: 'rejects duplicate registrations',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      prisma.seedUser({
        id: 'user-1',
        email: 'citizen@example.com',
        passwordHash: 'hashed',
        phone: null,
        emailVerified: false,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });

      const service = new AuthService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      await assert.rejects(
        () =>
          service.register({
            email: 'citizen@example.com',
            password: 'Password123!',
            rgpd_accepted: true,
          }),
        (error: unknown) =>
          error instanceof ConflictException &&
          error.message === 'Este email já está registado.',
      );
    },
  },
  {
    name: 'generates a reset token for an existing user',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';
      process.env.NODE_ENV = 'test';

      const prisma = new FakePrismaService();
      prisma.seedUser({
        id: 'user-16',
        email: 'citizen@example.com',
        passwordHash: 'hashed',
        phone: null,
        emailVerified: false,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });
      const redis = new FakeRedisClient();
      const service = new AuthService(
        prisma as never,
        new FakeRedisService(redis) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      const response = await service.forgotPassword({ email: 'citizen@example.com' });
      assert.equal(response.ok, true);
      assert.ok(response.reset_token);
    },
  },
  {
    name: 'resets password and invalidates active session',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';
      process.env.NODE_ENV = 'test';

      const prisma = new FakePrismaService();
      const originalHash = await bcrypt.hash('Password123!', 4);
      prisma.seedUser({
        id: 'user-19',
        email: 'citizen@example.com',
        passwordHash: originalHash,
        phone: null,
        emailVerified: true,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });
      const redis = new FakeRedisClient();
      const service = new AuthService(
        prisma as never,
        new FakeRedisService(redis) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      const login = await service.login({
        email: 'citizen@example.com',
        password: 'Password123!',
      }, FAKE_CTX);
      assert.ok(await redis.get('user:session:user-19'));

      const forgot = await service.forgotPassword({ email: 'citizen@example.com' });
      assert.ok(forgot.reset_token);

      await service.resetPassword({
        token: forgot.reset_token!,
        new_password: 'NewPassword123!',
      });

      assert.equal(await redis.get('user:session:user-19'), null);
      await assert.rejects(
        () =>
          service.refresh({
            refresh_token: login.refresh_token,
          }, FAKE_CTX),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Sessão inválida. Faça login novamente.',
      );
    },
  },
  {
    name: 'creates a session on login and rotates refresh tokens',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      const passwordHash = await bcrypt.hash('Password123!', 4);
      prisma.seedUser({
        id: 'user-42',
        email: 'citizen@example.com',
        passwordHash,
        phone: null,
        emailVerified: true,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });

      const redisClient = new FakeRedisClient();
      const service = new AuthService(
        prisma as never,
        new FakeRedisService(redisClient) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      const loginResult = await service.login({
        email: 'CITIZEN@example.com',
        password: 'Password123!',
      }, FAKE_CTX);

      assert.equal(loginResult.access_token, 'access-token-1');
      assert.equal(loginResult.requires_2fa, false);
      assert.equal(loginResult.pre_auth_token, null);
      assert.match(loginResult.refresh_token, /^user-42\.[a-f0-9]+$/);

      const firstSession = await redisClient.get('user:session:user-42');
      assert.ok(firstSession);

      const refreshResult = await service.refresh({
        refresh_token: loginResult.refresh_token,
      }, FAKE_CTX);

      assert.equal(refreshResult.access_token, 'access-token-2');
      assert.notEqual(refreshResult.refresh_token, loginResult.refresh_token);

      await assert.rejects(
        () =>
          service.refresh({
            refresh_token: loginResult.refresh_token,
          }, FAKE_CTX),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Sessão inválida. Faça login novamente.',
      );
    },
  },
  {
    name: 'clears the active session on logout',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      const passwordHash = await bcrypt.hash('Password123!', 4);
      prisma.seedUser({
        id: 'user-77',
        email: 'citizen@example.com',
        passwordHash,
        phone: null,
        emailVerified: true,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });

      const redisClient = new FakeRedisClient();
      const service = new AuthService(
        prisma as never,
        new FakeRedisService(redisClient) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      const loginResult = await service.login({
        email: 'citizen@example.com',
        password: 'Password123!',
      }, FAKE_CTX);

      assert.ok(await redisClient.get('user:session:user-77'));

      await service.logout('user-77');

      assert.equal(await redisClient.get('user:session:user-77'), null);

      await assert.rejects(
        () =>
          service.refresh({
            refresh_token: loginResult.refresh_token,
          }, FAKE_CTX),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Sessão inválida. Faça login novamente.',
      );
    },
  },
  {
    name: 'staff login/logout is recorded in the audit log (citizen is not)',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      const passwordHash = await bcrypt.hash('Password123!', 4);
      prisma.seedUser({
        id: 'gestor-1',
        email: 'gestor@example.com',
        passwordHash,
        phone: null,
        emailVerified: true,
        role: UserRole.GESTOR,
        eliminadoEm: null,
        cidadaoPerfil: { rgpdAccepted: true },
      });
      prisma.seedUser({
        id: 'cidadao-1',
        email: 'cidadao@example.com',
        passwordHash,
        phone: null,
        emailVerified: true,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: { rgpdAccepted: true },
      });

      const audit = new FakeAuditService();
      const service = new AuthService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        audit as never,
        new FakeTwoFactorService() as never,
      );

      await service.login({ email: 'gestor@example.com', password: 'Password123!' }, FAKE_CTX);
      await service.login({ email: 'cidadao@example.com', password: 'Password123!' }, FAKE_CTX);

      // Só o login do gestor (staff) entra na auditoria.
      assert.equal(audit.writes.length, 1);
      assert.equal(audit.writes[0]!.acao, 'login');
      assert.equal(audit.writes[0]!.papel, 'gestor');
      assert.equal(audit.writes[0]!.utilizador, 'gestor@example.com');

      await service.logout('gestor-1', FAKE_CTX);
      assert.equal(audit.writes.length, 2);
      assert.equal(audit.writes[1]!.acao, 'logout');
      assert.equal(audit.writes[1]!.papel, 'gestor');
    },
  },
  {
    name: 'rejects invalid credentials during login',
    run: async () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      process.env.BCRYPT_ROUNDS = '4';

      const prisma = new FakePrismaService();
      const passwordHash = await bcrypt.hash('Password123!', 4);
      prisma.seedUser({
        id: 'user-8',
        email: 'citizen@example.com',
        passwordHash,
        phone: null,
        emailVerified: true,
        role: UserRole.CIDADAO,
        eliminadoEm: null,
        cidadaoPerfil: {
          rgpdAccepted: true,
        },
      });

      const service = new AuthService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeJwtService() as never,
        new FakeMailService() as never,
        new FakeSecurityService() as never,
        new FakeSessionService() as never,
        new FakeAuditService() as never,
        new FakeTwoFactorService() as never,
      );

      await assert.rejects(
        () =>
          service.login({
            email: 'citizen@example.com',
            password: 'WrongPassword123!',
          }, FAKE_CTX),
        (error: unknown) =>
          error instanceof UnauthorizedException &&
          error.message === 'Email ou password incorrectos.',
      );
    },
  },
];

function selectFields<T extends object>(
  value: T,
  select: Record<string, boolean>,
): Partial<T> {
  const selectedEntries = Object.entries(select)
    .filter(([, enabled]) => enabled)
    .map(([key]) => [key, value[key as keyof T]]);

  return Object.fromEntries(selectedEntries) as Partial<T>;
}
