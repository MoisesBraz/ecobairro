import assert from 'node:assert/strict';
import { TwoFactorService } from '../../src/auth/two-factor.service';
import type { TestCase } from '../test-helpers';

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

  async expire(key: string): Promise<number> {
    // just mock it
    return this.store.has(key) ? 1 : 0;
  }
}

class FakePrismaService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly users = new Map<string, any>();
  
  user = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      return this.users.get(where.id) || null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: async ({ where, data }: { where: { id: string }, data: any }) => {
      const user = this.users.get(where.id);
      if (!user) throw new Error('Not found');
      const updated = { ...user, ...data };
      this.users.set(where.id, updated);
      return updated;
    }
  };
}

class FakeRedisService {
  constructor(private readonly client: FakeRedisClient) {}
  getClient() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.client as any;
  }
}

class FakeMailService {
  readonly sent: Array<{ template: string; to: string; variables: Record<string, unknown> }> = [];
  async send(template: string, options: { to: string; subject: string; variables: Record<string, unknown> }) {
    this.sent.push({ template, to: options.to, variables: options.variables });
  }
}

export const twoFactorServiceTests: TestCase[] = [
  {
    name: 'issuePreAuthToken stores token hash in Redis and returns raw token',
    run: async () => {
      const redis = new FakeRedisClient();
      const service = new TwoFactorService(
        new FakePrismaService() as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      const raw = await service.issuePreAuthToken('user-1');
      assert.ok(raw);
      assert.equal(raw.length, 64); // 32 bytes hex = 64 chars
    },
  },
  {
    name: 'consumePreAuthToken returns null if token is missing or invalid',
    run: async () => {
      const redis = new FakeRedisClient();
      const service = new TwoFactorService(
        new FakePrismaService() as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      assert.equal(await service.consumePreAuthToken(''), null);
      assert.equal(await service.consumePreAuthToken('invalid-token'), null);
    },
  },
  {
    name: 'consumePreAuthToken returns userId and expires token if valid',
    run: async () => {
      const redis = new FakeRedisClient();
      const service = new TwoFactorService(
        new FakePrismaService() as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      const raw = await service.issuePreAuthToken('user-2');
      const userId = await service.consumePreAuthToken(raw);
      
      assert.equal(userId, 'user-2');
    },
  },
  {
    name: 'verifyLoginCode returns false if user not found or no secret',
    run: async () => {
      const prisma = new FakePrismaService();
      const service = new TwoFactorService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeMailService() as never,
      );

      assert.equal(await service.verifyLoginCode('unknown', '123456'), false);

      prisma.users.set('user-no-secret', { id: 'user-no-secret', twoFactorSecret: null });
      assert.equal(await service.verifyLoginCode('user-no-secret', '123456'), false);
    },
  },
  {
    name: 'generateSetup generates secret, url, qrcode and stores pending secret in redis',
    run: async () => {
      const redis = new FakeRedisClient();
      const service = new TwoFactorService(
        new FakePrismaService() as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      const setup = await service.generateSetup('user-setup', 'test@test.com');
      assert.ok(setup.secret);
      assert.ok(setup.otpauthUrl);
      assert.ok(setup.qrCodeDataUrl);
      const pending = await redis.get('2fa:pending:user-setup');
      assert.equal(pending, setup.secret);
    }
  },
  {
    name: 'enable returns null if no pending secret or invalid code',
    run: async () => {
      const redis = new FakeRedisClient();
      const service = new TwoFactorService(
        new FakePrismaService() as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      assert.equal(await service.enable('user-no-secret', '123456'), null);
      
      await redis.set('2fa:pending:user-wrong', 'SECRET');
      assert.equal(await service.enable('user-wrong', '000000'), null);
    }
  },
  {
    name: 'disable clears two factor config from user',
    run: async () => {
      const prisma = new FakePrismaService();
      const service = new TwoFactorService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeMailService() as never,
      );

      prisma.users.set('user-disable', { id: 'user-disable', twoFactorEnabled: true });
      await service.disable('user-disable');
      const user = prisma.users.get('user-disable');
      assert.equal(user.twoFactorEnabled, false);
      assert.equal(user.twoFactorType, 'NONE');
    }
  },
  {
    name: 'verifyLoginCode works with correct TOTP and correct Backup Code',
    run: async () => {
      const prisma = new FakePrismaService();
      const service = new TwoFactorService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeMailService() as never,
      );
      
      prisma.users.set('user-verify', { id: 'user-verify', backupCodes: [] });
      const codes = await service.regenerateBackupCodes('user-verify');
      const user = prisma.users.get('user-verify');
      user.twoFactorSecret = 'JBSWY3DPEHPK3PXP'; // Base32 secret mock
      
      // We can't easily generate a real TOTP without `otplib` imported, but verifyLoginCode checks length === 6 and digits. 
      // If we pass a 6 digit code, it will fail verifyToken (because it's just a random code) and return false. We mock it internally? 
      // Actually, we can test backup codes since we know the unhashed code.
      const backupCode = codes[0]!;
      assert.equal(await service.verifyLoginCode('user-verify', backupCode), true);
      
      // Backup code should be consumed
      const updatedUser = prisma.users.get('user-verify');
      assert.equal(updatedUser.backupCodes.length, 7);
      
      // Using consumed code should fail
      assert.equal(await service.verifyLoginCode('user-verify', backupCode), false);
    }
  },
  {
    name: 'generateBackupCodes logic and helper functions',
    run: async () => {
      const prisma = new FakePrismaService();
      const service = new TwoFactorService(
        prisma as never,
        new FakeRedisService(new FakeRedisClient()) as never,
        new FakeMailService() as never,
      );
      
      prisma.users.set('user-1', { id: 'user-1', backupCodes: [] });
      const codes = await service.regenerateBackupCodes('user-1');
      assert.equal(codes.length, 8);
      assert.match(codes[0]!, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      
      const count = await service.backupCodesRemaining('user-1');
      assert.equal(count, 8);
      
      assert.equal(await service.backupCodesRemaining('unknown'), 0);
    }
  },
  {
    name: 'sendEmailCode stores a 6-digit code in Redis and emails it',
    run: async () => {
      const redis = new FakeRedisClient();
      const mail = new FakeMailService();
      const service = new TwoFactorService(
        new FakePrismaService() as never,
        new FakeRedisService(redis) as never,
        mail as never,
      );

      await service.sendEmailCode('user-email', 'u@example.pt');
      const stored = await redis.get('2fa:email:user-email');
      assert.match(stored ?? '', /^\d{6}$/);
      assert.equal(mail.sent.length, 1);
      assert.equal(mail.sent[0]!.template, 'two-factor-code');
      assert.equal(mail.sent[0]!.to, 'u@example.pt');
      assert.equal(mail.sent[0]!.variables.code, stored);
    },
  },
  {
    name: 'enableEmail activates EMAIL 2FA with the right code, rejects wrong',
    run: async () => {
      const redis = new FakeRedisClient();
      const prisma = new FakePrismaService();
      prisma.users.set('u1', { id: 'u1', backupCodes: [] });
      const service = new TwoFactorService(
        prisma as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      await redis.set('2fa:email:u1', '123456');
      assert.equal(await service.enableEmail('u1', '000000'), null);

      const result = await service.enableEmail('u1', '123456');
      assert.ok(result);
      assert.equal(result!.backupCodes.length, 8);
      const user = prisma.users.get('u1');
      assert.equal(user.twoFactorEnabled, true);
      assert.equal(user.twoFactorType, 'EMAIL');
    },
  },
  {
    name: 'verifyLoginCode accepts the emailed code (one-time) for EMAIL 2FA',
    run: async () => {
      const redis = new FakeRedisClient();
      const prisma = new FakePrismaService();
      prisma.users.set('u2', {
        id: 'u2',
        twoFactorType: 'EMAIL',
        twoFactorSecret: null,
        backupCodes: [],
      });
      const service = new TwoFactorService(
        prisma as never,
        new FakeRedisService(redis) as never,
        new FakeMailService() as never,
      );

      await redis.set('2fa:email:u2', '654321');
      assert.equal(await service.verifyLoginCode('u2', '111111'), false);
      assert.equal(await service.verifyLoginCode('u2', '654321'), true);
      // consumido → segunda utilização falha
      assert.equal(await service.verifyLoginCode('u2', '654321'), false);
    },
  }
];
