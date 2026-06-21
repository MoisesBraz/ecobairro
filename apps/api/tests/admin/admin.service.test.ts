import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { AdminService } from '../../src/admin/admin.service';
import type { AuthenticatedUser } from '../../src/auth/auth.types';
import type { TestCase } from '../test-helpers';

interface FakeUserRecord {
  id: string;
  email: string;
  eliminadoEm: Date | null;
}

class FakePrisma {
  userUpdate: { where: { id: string }; data: Record<string, unknown> } | null = null;
  perfilUpdateMany: { where: { userId: string }; data: Record<string, unknown> } | null = null;
  partilhaUpdateMany: { where: { userId: string }; data: Record<string, unknown> } | null = null;

  constructor(private readonly record: FakeUserRecord) {}

  readonly user = {
    findUnique: async (args: { where: { id: string } }) => {
      if (args.where.id === this.record.id) {
        return { ...this.record };
      }
      // Pedido de email do admin feito pela auditoria.
      return { email: 'admin@example.com' };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      this.userUpdate = args;
      return { ...this.record };
    },
  };

  readonly cidadaoPerfil = {
    updateMany: async (args: { where: { userId: string }; data: Record<string, unknown> }) => {
      this.perfilUpdateMany = args;
      return { count: 1 };
    },
  };

  readonly partilha = {
    updateMany: async (args: { where: { userId: string }; data: Record<string, unknown> }) => {
      this.partilhaUpdateMany = args;
      return { count: 0 };
    },
  };

  async $transaction(ops: Promise<unknown>[]): Promise<unknown[]> {
    return Promise.all(ops);
  }
}

class FakeSecurity {
  revokedUser: string | null = null;
  async revokeUser(id: string): Promise<void> {
    this.revokedUser = id;
  }
}

class FakeSession {
  revokedAll: string | null = null;
  async revokeAll(id: string): Promise<void> {
    this.revokedAll = id;
  }
}

class FakeAudit {
  writes: Array<Record<string, unknown>> = [];
  async write(entry: Record<string, unknown>): Promise<void> {
    this.writes.push(entry);
  }
}

function buildService(record: FakeUserRecord): {
  service: AdminService;
  prisma: FakePrisma;
  security: FakeSecurity;
  session: FakeSession;
  audit: FakeAudit;
} {
  const prisma = new FakePrisma(record);
  const security = new FakeSecurity();
  const session = new FakeSession();
  const audit = new FakeAudit();
  const service = new AdminService(
    prisma as never,
    {} as never,
    security as never,
    session as never,
    audit as never,
  );
  return { service, prisma, security, session, audit };
}

const admin: AuthenticatedUser = { userId: 'admin-1', role: 'ADMIN' } as AuthenticatedUser;

export const adminServiceTests: TestCase[] = [
  {
    name: 'deactivate anonymizes the user, frees the email and revokes access',
    run: async () => {
      const id = 'user-9';
      const { service, prisma, security, session, audit } = buildService({
        id,
        email: 'pessoa@example.com',
        eliminadoEm: null,
      });

      const result = await service.deactivate(admin, '203.0.113.5', id);

      assert.deepEqual(result, { id, ativo: false });

      // Email libertado para tombstone + PII limpa.
      assert.ok(prisma.userUpdate, 'user.update deve ser chamado');
      const data = prisma.userUpdate!.data;
      assert.equal(data.email, `anon_${id}@anon.invalid`);
      assert.equal(data.passwordHash, '__anonymized__');
      assert.equal(data.phone, null);
      assert.equal(data.emailVerified, false);
      assert.equal(data.twoFactorEnabled, false);
      assert.equal(data.twoFactorType, 'NONE');
      assert.equal(data.twoFactorSecret, null);
      assert.deepEqual(data.backupCodes, []);
      assert.ok(data.eliminadoEm instanceof Date, 'eliminadoEm deve ser uma Date');

      // Perfil e partilhas anonimizados.
      assert.equal(prisma.perfilUpdateMany?.where.userId, id);
      assert.equal(prisma.perfilUpdateMany?.data.nomeCompleto, null);
      assert.equal(prisma.partilhaUpdateMany?.where.userId, id);
      assert.equal(prisma.partilhaUpdateMany?.data.autorNome, 'Utilizador anónimo');

      // Acesso revogado.
      assert.equal(security.revokedUser, id);
      assert.equal(session.revokedAll, id);

      // Auditoria não grava o email original (usa o id).
      assert.equal(audit.writes.length, 1);
      const entry = audit.writes[0]!;
      assert.equal(entry.acao, 'delete');
      assert.ok(
        String(entry.descricao).includes(id) &&
          !String(entry.descricao).includes('pessoa@example.com'),
      );
    },
  },
  {
    name: 'deactivate is a no-op when the user is already deleted',
    run: async () => {
      const id = 'user-already';
      const { service, prisma, security, session } = buildService({
        id,
        email: 'x@example.com',
        eliminadoEm: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.deactivate(admin, '203.0.113.5', id);

      assert.deepEqual(result, { id, ativo: false });
      assert.equal(prisma.userUpdate, null);
      assert.equal(security.revokedUser, null);
      assert.equal(session.revokedAll, null);
    },
  },
  {
    name: 'deactivate refuses self-deactivation',
    run: async () => {
      const { service } = buildService({
        id: admin.userId,
        email: 'admin@example.com',
        eliminadoEm: null,
      });

      await assert.rejects(
        () => service.deactivate(admin, '203.0.113.5', admin.userId),
        ForbiddenException,
      );
    },
  },
  {
    name: 'deactivate refuses non-admin callers',
    run: async () => {
      const caller = { userId: 'gestor-1', role: 'GESTOR' } as AuthenticatedUser;
      const { service } = buildService({
        id: 'user-1',
        email: 'a@example.com',
        eliminadoEm: null,
      });

      await assert.rejects(
        () => service.deactivate(caller, '203.0.113.5', 'user-1'),
        ForbiddenException,
      );
    },
  },
];
