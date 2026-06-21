import assert from 'node:assert/strict';
import { AuditService } from '../../src/audit/audit.service';
import type { TestCase } from '../test-helpers';

class FakePrismaAudit {
  constructor(private readonly rows: Array<Record<string, unknown>> = []) {}
  readonly auditLog = {
    findMany: async () =>
      this.rows.map((r) => ({
        id: 'a1',
        utilizador: 'x@x.pt',
        papel: 'ADMIN',
        acao: 'login',
        descricao: 'd',
        ip: '127.0.0.1',
        criadoEm: new Date('2026-06-18T10:00:00.000Z'),
        ...r,
      })),
    count: async () => this.rows.length,
  };
  async $transaction<T>(input: Promise<T>[]): Promise<T[]> {
    return Promise.all(input);
  }
}

export const auditServiceTests: TestCase[] = [
  {
    name: 'blocks audit log access for non-manager roles',
    run: async () => {
      const service = new AuditService(new FakePrismaAudit() as never);
      await assert.rejects(() => service.list('CIDADAO' as never, {}));
      await assert.rejects(() => service.list('OPERADOR' as never, {}));
    },
  },
  {
    name: 'allows audit log access for gestor/admin',
    run: async () => {
      const service = new AuditService(new FakePrismaAudit([{}]) as never);
      const gestor = await service.list('GESTOR' as never, {});
      assert.equal(gestor.total, 1);
      const admin = await service.list('ADMIN' as never, {});
      assert.equal(admin.total, 1);
    },
  },
];
