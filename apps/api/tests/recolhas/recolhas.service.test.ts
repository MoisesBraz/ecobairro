import assert from 'node:assert/strict';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    findUnique: async (args: {
      where: { id: string };
      select?: { status?: boolean; userId?: boolean };
    }) => {
      const row = this.store.find((r) => r.id === args.where.id);
      if (!row) return null;
      return args.select ? { status: row.status, userId: row.userId } : { ...row };
    },
    update: async (args: {
      where: { id: string };
      data: { status?: string; dataPrevista?: string | null };
    }) => {
      const row = this.store.find((r) => r.id === args.where.id);
      if (!row) {
        throw new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        });
      }
      if (args.data.status !== undefined) row.status = args.data.status;
      if (args.data.dataPrevista !== undefined) {
        row.dataPrevista = args.data.dataPrevista ?? null;
      }
      return { ...row };
    },
    updateMany: async (args: {
      where: { id: string; userId: string; status: string };
      data: { status: string };
    }) => {
      const row = this.store.find(
        (r) => r.id === args.where.id && r.userId === args.where.userId && r.status === args.where.status,
      );
      if (!row) return { count: 0 };
      row.status = args.data.status;
      return { count: 1 };
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
  {
    name: 'staff atualiza o estado e a data prevista de uma recolha',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: 'r1', tipo: 'Monos', subtipo: 'Sofá', morada: 'Rua X', status: 'pendente',
          obs: null, criadoEm: new Date('2026-05-01T10:00:00.000Z'), dataPrevista: null, userId: 'u1',
        },
      ]);
      const service = new RecolhasService(prisma as never);
      const updated = await service.updateStatus('GESTOR', 'r1', {
        status: 'agendado',
        data_prevista: '10/07/2026',
      });
      assert.equal(updated.status, 'agendado');
      assert.equal(updated.data_prevista, '10/07/2026');
    },
  },
  {
    name: 'cidadão não pode atualizar o estado de uma recolha (403)',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: 'r1', tipo: 'Monos', subtipo: 'Sofá', morada: 'Rua X', status: 'pendente',
          obs: null, criadoEm: new Date('2026-05-01T10:00:00.000Z'), dataPrevista: null, userId: 'u1',
        },
      ]);
      const service = new RecolhasService(prisma as never);
      await assert.rejects(
        () => service.updateStatus('CIDADAO', 'r1', { status: 'concluido' }),
        (e: Error) => e instanceof ForbiddenException && e.message === 'Não tem permissão para esta acção.',
      );
    },
  },
  {
    name: 'atualizar recolha inexistente devolve 404',
    run: async () => {
      const service = new RecolhasService(new FakePrismaRecolhas() as never);
      await assert.rejects(
        () => service.updateStatus('GESTOR', 'nao-existe', { status: 'agendado' }),
        (e: Error) => e instanceof NotFoundException && e.message === 'O recurso pedido não foi encontrado.',
      );
    },
  },
  {
    name: 'transição inválida de estado devolve 400',
    run: async () => {
      const { BadRequestException } = await import('@nestjs/common');
      const prisma = new FakePrismaRecolhas([
        {
          id: 'r2', tipo: 'Entulho', subtipo: 'Tijolos', morada: 'Rua Y', status: 'concluido',
          obs: null, criadoEm: new Date('2026-05-01T10:00:00.000Z'), dataPrevista: null, userId: 'u1',
        },
      ]);
      const service = new RecolhasService(prisma as never);
      await assert.rejects(
        () => service.updateStatus('GESTOR', 'r2', { status: 'pendente' }),
        (e: Error) => e instanceof BadRequestException,
      );
    },
  },
  {
    name: 'cidadão cancela o próprio pedido pendente',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: 'r3', tipo: 'Monos', subtipo: 'Sofá', morada: 'Rua X', status: 'pendente',
          obs: null, criadoEm: new Date('2026-05-01T10:00:00.000Z'), dataPrevista: null, userId: 'u1',
        },
      ]);
      const service = new RecolhasService(prisma as never);

      const result = await service.cancel('u1', 'CIDADAO', 'r3');

      assert.equal(result.status, 'cancelado');
    },
  },
  {
    name: 'cidadão não cancela pedido de outro utilizador',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: 'r4', tipo: 'Monos', subtipo: 'Sofá', morada: 'Rua X', status: 'pendente',
          obs: null, criadoEm: new Date('2026-05-01T10:00:00.000Z'), dataPrevista: null, userId: 'u2',
        },
      ]);
      const service = new RecolhasService(prisma as never);

      await assert.rejects(
        () => service.cancel('u1', 'CIDADAO', 'r4'),
        (error: Error) => error instanceof NotFoundException,
      );
    },
  },
  {
    name: 'cidadão não cancela pedido já agendado',
    run: async () => {
      const prisma = new FakePrismaRecolhas([
        {
          id: 'r5', tipo: 'Monos', subtipo: 'Sofá', morada: 'Rua X', status: 'agendado',
          obs: null, criadoEm: new Date('2026-05-01T10:00:00.000Z'), dataPrevista: '10/07/2026', userId: 'u1',
        },
      ]);
      const service = new RecolhasService(prisma as never);

      await assert.rejects(
        () => service.cancel('u1', 'CIDADAO', 'r5'),
        (error: Error) => error instanceof ConflictException,
      );
    },
  },
];
