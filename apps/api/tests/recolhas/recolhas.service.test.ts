import assert from 'node:assert/strict';
import { RecolhasService } from '../../src/recolhas/recolhas.service';
import type { TestCase } from '../test-helpers';

interface FakeRecolhaRow {
  id: string;
  tipo: string;
  subtipo: string;
  morada: string;
  status: string;
  obs: string | null;
  criadoEm: Date;
  dataPrevista: string | null;
  userId: string | null;
}

class FakePrismaRecolhas {
  private store: FakeRecolhaRow[];
  private nextId = 1;

  constructor(initial: FakeRecolhaRow[] = []) {
    this.store = initial.map((r) => ({ ...r, criadoEm: new Date(r.criadoEm) }));
  }

  readonly recolha = {
    findMany: async (args: {
      where: { userId?: string; status?: string };
      orderBy: { criadoEm: 'desc' };
      skip: number;
      take: number;
    }) => {
      let rows = args.where.userId
        ? this.store.filter((r) => r.userId === args.where.userId)
        : [...this.store];
      if (args.where.status) {
        rows = rows.filter((r) => r.status === args.where.status);
      }
      rows.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
      return rows.slice(args.skip, args.skip + args.take).map((r) => ({ ...r }));
    },
    count: async (args: { where: { userId?: string; status?: string } }) => {
      let rows = args.where.userId
        ? this.store.filter((r) => r.userId === args.where.userId)
        : [...this.store];
      if (args.where.status) {
        rows = rows.filter((r) => r.status === args.where.status);
      }
      return rows.length;
    },
    create: async (args: {
      data: {
        tipo: string;
        subtipo: string;
        morada: string;
        obs: string | null;
        userId: string;
      };
    }) => {
      const row: FakeRecolhaRow = {
        id: `rec-${this.nextId++}`,
        tipo: args.data.tipo,
        subtipo: args.data.subtipo,
        morada: args.data.morada,
        status: 'pendente',
        obs: args.data.obs,
        criadoEm: new Date('2026-05-01T12:00:00.000Z'),
        dataPrevista: null,
        userId: args.data.userId,
      };
      this.store.push(row);
      return { ...row };
    },
  };

  async $transaction<T>(input: Promise<T>[]): Promise<T[]> {
    return Promise.all(input);
  }
}

export const recolhasServiceTests: TestCase[] = [
  {
    name: 'creates recolha with status pendente for authenticated user',
    run: async () => {
      const prisma = new FakePrismaRecolhas();
      const service = new RecolhasService(prisma as never);
      const row = await service.create('user-abc', {
        tipo: 'Monos Volumosos',
        subtipo: 'Sofá de 2 lugares',
        morada: 'Rua Direita, 8',
        obs: 'Elevador pequeno',
      });
      assert.equal(row.status, 'pendente');
      assert.equal(row.user_id, 'user-abc');
      assert.equal(row.tipo, 'Monos Volumosos');
    },
  },
  {
    name: 'lists only recolhas for that user id',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: '1',
          tipo: 'Entulho',
          subtipo: 'Tijolos',
          morada: 'A',
          status: 'pendente',
          obs: null,
          criadoEm: new Date('2026-05-02T10:00:00.000Z'),
          dataPrevista: null,
          userId: 'u1',
        },
        {
          id: '2',
          tipo: 'Monos',
          subtipo: 'Frigorífico',
          morada: 'B',
          status: 'agendado',
          obs: null,
          criadoEm: new Date('2026-05-01T10:00:00.000Z'),
          dataPrevista: '10/05/2026',
          userId: 'u2',
        },
      ]);
      const service = new RecolhasService(prisma as never);
      const res = await service.list('u1', 'CIDADAO', { page: 1, pageSize: 10 });
      assert.equal(res.total, 1);
      assert.equal(res.recolhas[0]!.id, '1');
    },
  },
  {
    name: 'filters recolhas by status',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: 'a',
          tipo: 'Monos',
          subtipo: 'x',
          morada: 'm1',
          status: 'pendente',
          obs: null,
          criadoEm: new Date('2026-05-01T10:00:00.000Z'),
          dataPrevista: null,
          userId: 'u',
        },
        {
          id: 'b',
          tipo: 'Monos',
          subtipo: 'y',
          morada: 'm2',
          status: 'concluido',
          obs: null,
          criadoEm: new Date('2026-05-03T10:00:00.000Z'),
          dataPrevista: '01/05/2026',
          userId: 'u',
        },
      ]);
      const service = new RecolhasService(prisma as never);
      const res = await service.list('u', 'CIDADAO', { page: 1, pageSize: 10, status: 'concluido' });
      assert.equal(res.total, 1);
      assert.equal(res.recolhas[0]!.status, 'concluido');
    },
  },
  {
    name: 'lists all recolhas for operational roles',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: '1',
          tipo: 'Entulho',
          subtipo: 'Tijolos',
          morada: 'A',
          status: 'pendente',
          obs: null,
          criadoEm: new Date('2026-05-02T10:00:00.000Z'),
          dataPrevista: null,
          userId: 'u1',
        },
        {
          id: '2',
          tipo: 'Monos',
          subtipo: 'Frigorífico',
          morada: 'B',
          status: 'agendado',
          obs: null,
          criadoEm: new Date('2026-05-01T10:00:00.000Z'),
          dataPrevista: '10/05/2026',
          userId: 'u2',
        },
      ]);
      const service = new RecolhasService(prisma as never);
      const res = await service.list('gestor', 'OPERADOR', { page: 1, pageSize: 10 });
      assert.equal(res.total, 2);
      assert.deepEqual(res.recolhas.map((r) => r.id), ['1', '2']);
    },
  },
];
