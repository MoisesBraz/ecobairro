import assert from 'node:assert/strict';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EquipasService } from '../../src/equipas/equipas.service';
import type { TestCase } from '../test-helpers';

interface FakeEquipa {
  id: string;
  nome: string;
  criadoEm: Date;
  atualizadoEm: Date;
}
interface FakeMembro {
  id: string;
  equipaId: string;
  userId: string;
}
interface FakeUser {
  id: string;
  email: string;
  role: string;
  eliminadoEm: Date | null;
}
interface FakeRota {
  id: string;
  nome: string;
  estado: string;
  operadorId: string | null;
  equipaId: string | null;
}

function makeKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: 'test' });
}

class FakePrisma {
  private readonly equipasStore: FakeEquipa[];
  private readonly membrosStore: FakeMembro[];
  private readonly usersStore: FakeUser[];
  private readonly rotasStore: FakeRota[];
  private seq = 1;

  constructor(opts: {
    equipas?: FakeEquipa[];
    membros?: FakeMembro[];
    users?: FakeUser[];
    rotas?: FakeRota[];
  }) {
    this.equipasStore = (opts.equipas ?? []).map((e) => ({ ...e }));
    this.membrosStore = (opts.membros ?? []).map((m) => ({ ...m }));
    this.usersStore = opts.users ?? [];
    this.rotasStore = opts.rotas ?? [];
  }

  private assemble(eq: FakeEquipa) {
    return {
      ...eq,
      membros: this.membrosStore
        .filter((m) => m.equipaId === eq.id)
        .map((m) => {
          const u = this.usersStore.find((x) => x.id === m.userId);
          return { id: m.id, userId: m.userId, user: { id: m.userId, email: u?.email ?? 'sem-email' } };
        }),
      rotas: this.rotasStore
        .filter((r) => r.equipaId === eq.id)
        .map((r) => ({ id: r.id, nome: r.nome, estado: r.estado, operadorId: r.operadorId })),
    };
  }

  readonly equipa = {
    findMany: async () => this.equipasStore.map((e) => this.assemble(e)),

    create: async (args: { data: { nome: string } }) => {
      const now = new Date('2026-06-18T10:00:00.000Z');
      const eq: FakeEquipa = {
        id: `eq-${this.seq++}`,
        nome: args.data.nome,
        criadoEm: now,
        atualizadoEm: now,
      };
      this.equipasStore.push(eq);
      return this.assemble(eq);
    },

    update: async (args: { where: { id: string }; data: { nome: string } }) => {
      const eq = this.equipasStore.find((e) => e.id === args.where.id);
      if (!eq) throw makeKnownError('P2025');
      eq.nome = args.data.nome;
      return this.assemble(eq);
    },

    delete: async (args: { where: { id: string } }) => {
      const idx = this.equipasStore.findIndex((e) => e.id === args.where.id);
      if (idx === -1) throw makeKnownError('P2025');
      const [removed] = this.equipasStore.splice(idx, 1);
      // cascade membros
      for (let i = this.membrosStore.length - 1; i >= 0; i--) {
        if (this.membrosStore[i]!.equipaId === removed!.id) this.membrosStore.splice(i, 1);
      }
      return removed!;
    },

    findUnique: async (args: { where: { id: string }; select?: { id: true } }) => {
      const eq = this.equipasStore.find((e) => e.id === args.where.id);
      if (!eq) return null;
      if (args.select?.id) return { id: eq.id };
      return this.assemble(eq);
    },
  };

  readonly equipaMembro = {
    create: async (args: { data: { equipaId: string; userId: string } }) => {
      const dup = this.membrosStore.find(
        (m) => m.equipaId === args.data.equipaId && m.userId === args.data.userId,
      );
      if (dup) throw makeKnownError('P2002');
      const m: FakeMembro = { id: `m-${this.seq++}`, ...args.data };
      this.membrosStore.push(m);
      return m;
    },
    deleteMany: async (args: { where: { equipaId: string; userId: string } }) => {
      let count = 0;
      for (let i = this.membrosStore.length - 1; i >= 0; i--) {
        const m = this.membrosStore[i]!;
        if (m.equipaId === args.where.equipaId && m.userId === args.where.userId) {
          this.membrosStore.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
  };

  readonly user = {
    findFirst: async (args: { where: { id: string; role?: string; eliminadoEm?: null } }) => {
      const u = this.usersStore.find(
        (x) =>
          x.id === args.where.id &&
          (args.where.role === undefined || x.role === args.where.role) &&
          (args.where.eliminadoEm === undefined || x.eliminadoEm === null),
      );
      return u ? { id: u.id } : null;
    },
    findMany: async (args: { where: { role: string; eliminadoEm: null } }) =>
      this.usersStore
        .filter((u) => u.role === args.where.role && u.eliminadoEm === null)
        .map((u) => ({ id: u.id, email: u.email })),
  };
}

const isForbidden = (e: Error) =>
  e instanceof ForbiddenException && e.message === 'Não tem permissão para esta acção.';
const isNotFound = (e: Error) =>
  e instanceof NotFoundException && e.message === 'O recurso pedido não foi encontrado.';

function buildEquipa(overrides: Partial<FakeEquipa> = {}): FakeEquipa {
  const now = new Date('2026-06-18T09:00:00.000Z');
  return {
    id: overrides.id ?? 'eq-seed',
    nome: overrides.nome ?? 'Equipa Seed',
    criadoEm: overrides.criadoEm ?? now,
    atualizadoEm: overrides.atualizadoEm ?? now,
  };
}

export const equipasServiceTests: TestCase[] = [
  {
    name: 'listOperadores devolve apenas operadores ativos (gestor)',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          users: [
            { id: 'op-1', email: 'op1@x', role: 'OPERADOR', eliminadoEm: null },
            { id: 'g-1', email: 'gestor@x', role: 'GESTOR', eliminadoEm: null },
            { id: 'op-2', email: 'op2@x', role: 'OPERADOR', eliminadoEm: new Date() },
          ],
        }) as never,
      );

      const res = await service.listOperadores('GESTOR');
      assert.deepEqual(res.operadores.map((o) => o.id), ['op-1']);
    },
  },
  {
    name: 'listOperadores é proibido para operador (403)',
    run: async () => {
      const service = new EquipasService(new FakePrisma({}) as never);
      await assert.rejects(() => service.listOperadores('OPERADOR'), isForbidden);
    },
  },
  {
    name: 'list devolve equipas com membros e rotas (gestor)',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          equipas: [buildEquipa({ id: 'eq-1', nome: 'Centro' })],
          membros: [{ id: 'm-1', equipaId: 'eq-1', userId: 'op-1' }],
          users: [{ id: 'op-1', email: 'op1@x', role: 'OPERADOR', eliminadoEm: null }],
          rotas: [{ id: 'r-1', nome: 'Rota A', estado: 'ativa', operadorId: 'op-1', equipaId: 'eq-1' }],
        }) as never,
      );

      const res = await service.list('GESTOR');
      assert.equal(res.total, 1);
      assert.equal(res.equipas[0]?.membros[0]?.email, 'op1@x');
      assert.equal(res.equipas[0]?.rotas[0]?.id, 'r-1');
    },
  },
  {
    name: 'list é proibido para cidadão (403)',
    run: async () => {
      const service = new EquipasService(new FakePrisma({}) as never);
      await assert.rejects(() => service.list('CIDADAO'), isForbidden);
    },
  },
  {
    name: 'create cria equipa (gestor)',
    run: async () => {
      const service = new EquipasService(new FakePrisma({}) as never);
      const eq = await service.create('GESTOR', { nome: 'Equipa Norte' });
      assert.equal(eq.nome, 'Equipa Norte');
      assert.equal(eq.membros.length, 0);
    },
  },
  {
    name: 'create é proibido para operador (403)',
    run: async () => {
      const service = new EquipasService(new FakePrisma({}) as never);
      await assert.rejects(() => service.create('OPERADOR', { nome: 'X' }), isForbidden);
    },
  },
  {
    name: 'update renomeia a equipa (gestor)',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({ equipas: [buildEquipa({ id: 'eq-1', nome: 'Antigo' })] }) as never,
      );
      const eq = await service.update('GESTOR', 'eq-1', { nome: 'Novo' });
      assert.equal(eq.nome, 'Novo');
    },
  },
  {
    name: 'update de equipa inexistente devolve 404',
    run: async () => {
      const service = new EquipasService(new FakePrisma({}) as never);
      await assert.rejects(() => service.update('GESTOR', 'eq-x', { nome: 'Novo' }), isNotFound);
    },
  },
  {
    name: 'remove elimina equipa (gestor); inexistente devolve 404',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({ equipas: [buildEquipa({ id: 'eq-1' })] }) as never,
      );
      const ok = await service.remove('GESTOR', 'eq-1');
      assert.deepEqual(ok, { ok: true });
      await assert.rejects(() => service.remove('GESTOR', 'eq-1'), isNotFound);
    },
  },
  {
    name: 'addMembro adiciona operador à equipa',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          equipas: [buildEquipa({ id: 'eq-1' })],
          users: [{ id: 'op-1', email: 'op1@x', role: 'OPERADOR', eliminadoEm: null }],
        }) as never,
      );
      const eq = await service.addMembro('GESTOR', 'eq-1', { userId: 'op-1' });
      assert.deepEqual(eq.membros.map((m) => m.userId), ['op-1']);
    },
  },
  {
    name: 'addMembro a equipa inexistente devolve 404',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          users: [{ id: 'op-1', email: 'op1@x', role: 'OPERADOR', eliminadoEm: null }],
        }) as never,
      );
      await assert.rejects(() => service.addMembro('GESTOR', 'eq-x', { userId: 'op-1' }), isNotFound);
    },
  },
  {
    name: 'addMembro com utilizador que não é operador devolve 404 (utilizador)',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          equipas: [buildEquipa({ id: 'eq-1' })],
          users: [{ id: 'g-1', email: 'gestor@x', role: 'GESTOR', eliminadoEm: null }],
        }) as never,
      );
      await assert.rejects(
        () => service.addMembro('GESTOR', 'eq-1', { userId: 'g-1' }),
        (e: Error) => e instanceof NotFoundException && e.message === 'Utilizador não encontrado.',
      );
    },
  },
  {
    name: 'addMembro duplicado devolve 409',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          equipas: [buildEquipa({ id: 'eq-1' })],
          membros: [{ id: 'm-1', equipaId: 'eq-1', userId: 'op-1' }],
          users: [{ id: 'op-1', email: 'op1@x', role: 'OPERADOR', eliminadoEm: null }],
        }) as never,
      );
      await assert.rejects(
        () => service.addMembro('GESTOR', 'eq-1', { userId: 'op-1' }),
        (e: Error) =>
          e instanceof ConflictException && e.message === 'Já existe um registo com estes dados.',
      );
    },
  },
  {
    name: 'removeMembro remove o colaborador da equipa',
    run: async () => {
      const service = new EquipasService(
        new FakePrisma({
          equipas: [buildEquipa({ id: 'eq-1' })],
          membros: [{ id: 'm-1', equipaId: 'eq-1', userId: 'op-1' }],
          users: [{ id: 'op-1', email: 'op1@x', role: 'OPERADOR', eliminadoEm: null }],
        }) as never,
      );
      const eq = await service.removeMembro('GESTOR', 'eq-1', 'op-1');
      assert.equal(eq.membros.length, 0);
    },
  },
  {
    name: 'addMembro é proibido para operador (403)',
    run: async () => {
      const service = new EquipasService(new FakePrisma({}) as never);
      await assert.rejects(
        () => service.addMembro('OPERADOR', 'eq-1', { userId: 'op-1' }),
        isForbidden,
      );
    },
  },
];
