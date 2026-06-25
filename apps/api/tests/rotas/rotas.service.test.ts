import assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RotasService } from '../../src/rotas/rotas.service';
import type { TestCase } from '../test-helpers';

interface FakeRota {
  id: string;
  nome: string;
  operador: string;
  operadorId: string | null;
  equipaId: string | null;
  estado: string;
  ecopontos: number;
  distancia: string;
  duracao: string;
  waypoints: unknown;
  geometria: unknown;
  paragens: unknown;
  zona: string | null;
  cor: string;
  criadoEm: Date;
}

interface FakeUser {
  id: string;
  email: string;
  role: string;
  eliminadoEm: Date | null;
}

interface FakeMembro {
  equipaId: string;
  userId: string;
}

type Where = Record<string, unknown>;

function makeP2025(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

class FakePrisma {
  private readonly rotasStore: FakeRota[];
  private readonly users: FakeUser[];
  private readonly membros: FakeMembro[];

  constructor(opts: { rotas?: FakeRota[]; users?: FakeUser[]; membros?: FakeMembro[] }) {
    this.rotasStore = (opts.rotas ?? []).map((r) => ({ ...r }));
    this.users = opts.users ?? [];
    this.membros = opts.membros ?? [];
  }

  readonly rota = {
    create: async (args: { data: Record<string, unknown> }) => {
      const d = args.data;
      const n = this.rotasStore.length + 1;
      const row = buildRota({
        id: `00000000-0000-0000-0000-0000000000${n.toString().padStart(2, '0')}`,
        nome: d.nome as string,
        operador: d.operador as string,
        estado: d.estado as string,
        ecopontos: d.ecopontos as number,
        distancia: d.distancia as string,
        duracao: d.duracao as string,
        waypoints: d.waypoints,
        geometria: d.geometria,
        paragens: d.paragens,
        zona: (d.zona as string | null) ?? null,
        cor: d.cor as string,
      });
      this.rotasStore.push(row);
      return { ...row };
    },

    findMany: async (args: { where?: Where }) =>
      this.applyWhere(args?.where).map((r) => ({ ...r })),

    findFirst: async (args: { where?: { AND?: Where[] } }) => {
      const and = args?.where?.AND ?? [];
      const idCond = and.find((c) => 'id' in c)?.id as string | undefined;
      const scope = and.find((c) => 'OR' in c || Object.keys(c).length === 0) ?? {};
      let rows = this.applyWhere(scope);
      if (idCond) rows = rows.filter((r) => r.id === idCond);
      const r = rows[0];
      return r ? { id: r.id } : null;
    },

    findUnique: async (args: { where: { id: string } }) => {
      const r = this.rotasStore.find((x) => x.id === args.where.id);
      return r ? { id: r.id } : null;
    },

    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const r = this.rotasStore.find((x) => x.id === args.where.id);
      if (!r) throw makeP2025();
      const d = args.data;
      if (d.estado !== undefined) r.estado = d.estado as string;
      if (d.operador !== undefined) r.operador = d.operador as string;
      if (d.equipa) {
        const op = d.equipa as { disconnect?: boolean; connect?: { id: string } };
        r.equipaId = op.disconnect ? null : op.connect!.id;
      }
      if (d.operadorRef) {
        const op = d.operadorRef as { disconnect?: boolean; connect?: { id: string } };
        r.operadorId = op.disconnect ? null : op.connect!.id;
      }
      return { ...r };
    },

    delete: async (args: { where: { id: string } }) => {
      const i = this.rotasStore.findIndex((x) => x.id === args.where.id);
      if (i === -1) throw makeP2025();
      const [removed] = this.rotasStore.splice(i, 1);
      return { ...removed! };
    },
  };

  readonly equipaMembro = {
    findMany: async (args: { where: { userId: string } }) =>
      this.membros
        .filter((m) => m.userId === args.where.userId)
        .map((m) => ({ equipaId: m.equipaId })),
  };

  readonly user = {
    findFirst: async (args: {
      where: { id: string; role?: string; eliminadoEm?: null };
    }) => {
      const u = this.users.find(
        (x) =>
          x.id === args.where.id &&
          (args.where.role === undefined || x.role === args.where.role) &&
          (args.where.eliminadoEm === undefined || x.eliminadoEm === null),
      );
      return u ? { id: u.id, email: u.email } : null;
    },
  };

  private applyWhere(where?: Where): FakeRota[] {
    if (!where || Object.keys(where).length === 0) return this.rotasStore;
    const or = where.OR as
      | Array<{ operadorId?: string; equipaId?: { in: (string | null)[] } }>
      | undefined;
    if (or) {
      return this.rotasStore.filter((r) =>
        or.some((c) => {
          if (c.operadorId !== undefined) return r.operadorId === c.operadorId;
          if (c.equipaId?.in) return c.equipaId.in.includes(r.equipaId);
          return false;
        }),
      );
    }
    return this.rotasStore;
  }
}

function buildRota(overrides: Partial<FakeRota> = {}): FakeRota {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-0000000000aa',
    nome: overrides.nome ?? 'Rota teste',
    operador: overrides.operador ?? 'desconhecido',
    operadorId: overrides.operadorId ?? null,
    equipaId: overrides.equipaId ?? null,
    estado: overrides.estado ?? 'pendente',
    ecopontos: overrides.ecopontos ?? 0,
    distancia: overrides.distancia ?? '',
    duracao: overrides.duracao ?? '',
    waypoints: overrides.waypoints ?? [],
    geometria: overrides.geometria ?? [],
    paragens: overrides.paragens ?? [],
    zona: overrides.zona ?? null,
    cor: overrides.cor ?? '#60a5fa',
    criadoEm: overrides.criadoEm ?? new Date('2026-06-18T09:00:00.000Z'),
  };
}

function buildCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Rota Centro — gerada',
    zona: 'Centro',
    cor: '#22c55e',
    distancia: '3.4 km',
    duracao: '25 min',
    waypoints: [
      [40.64, -8.65],
      [40.645, -8.652],
    ],
    geometria: [
      [40.64, -8.65],
      [40.642, -8.651],
      [40.645, -8.652],
    ],
    paragens: [
      { id: 'e-1', nome: 'Eco 1', lat: 40.64, lng: -8.65, ocupacao: 90, ordem: 1 },
      { id: 'e-2', nome: 'Eco 2', lat: 40.645, lng: -8.652, ocupacao: 70, ordem: 2 },
    ],
    ecopontoIds: ['e-1', 'e-2'],
    ...overrides,
  };
}

const isForbidden = (e: Error) =>
  e instanceof ForbiddenException && e.message === 'Não tem permissão para esta acção.';
const isNotFound = (e: Error) =>
  e instanceof NotFoundException && e.message === 'O recurso pedido não foi encontrado.';

export const rotasServiceTests: TestCase[] = [
  {
    name: 'operador só vê as rotas atribuídas (diretas ou via equipa)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [
            buildRota({ id: 'r-direct', operadorId: 'op-1' }),
            buildRota({ id: 'r-team', equipaId: 'eq-1' }),
            buildRota({ id: 'r-other', operadorId: 'op-2', equipaId: 'eq-9' }),
          ],
          membros: [{ equipaId: 'eq-1', userId: 'op-1' }],
        }) as never,
      );

      const res = await service.list({ userId: 'op-1', role: 'OPERADOR' });
      const ids = res.rotas.map((r) => r.id).sort();
      assert.deepEqual(ids, ['r-direct', 'r-team']);
      assert.equal(res.total, 2);
    },
  },
  {
    name: 'operador sem equipa só vê rotas atribuídas diretamente',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [
            buildRota({ id: 'r-direct', operadorId: 'op-1' }),
            buildRota({ id: 'r-team', equipaId: 'eq-1' }),
          ],
          membros: [],
        }) as never,
      );

      const res = await service.list({ userId: 'op-1', role: 'OPERADOR' });
      assert.deepEqual(res.rotas.map((r) => r.id), ['r-direct']);
    },
  },
  {
    name: 'gestor/admin vê todas as rotas',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [
            buildRota({ id: 'r1', operadorId: 'op-1' }),
            buildRota({ id: 'r2', equipaId: 'eq-1' }),
            buildRota({ id: 'r3' }),
          ],
        }) as never,
      );

      const gestor = await service.list({ userId: 'g-1', role: 'GESTOR' });
      assert.equal(gestor.total, 3);
      const admin = await service.list({ userId: 'a-1', role: 'ADMIN' });
      assert.equal(admin.total, 3);
    },
  },
  {
    name: 'operador inicia/conclui a sua própria rota (muda estado)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r-mine', operadorId: 'op-1', estado: 'pendente' })],
        }) as never,
      );

      const updated = await service.update('r-mine', { estado: 'ativa' }, { userId: 'op-1', role: 'OPERADOR' });
      assert.equal(updated.estado, 'ativa');
    },
  },
  {
    name: 'operador não pode mudar estado de rota que não é sua (403)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r-other', operadorId: 'op-2' })],
        }) as never,
      );

      await assert.rejects(
        () => service.update('r-other', { estado: 'ativa' }, { userId: 'op-1', role: 'OPERADOR' }),
        isForbidden,
      );
    },
  },
  {
    name: 'operador a atualizar rota inexistente recebe 404',
    run: async () => {
      const service = new RotasService(new FakePrisma({ rotas: [] }) as never);

      await assert.rejects(
        () => service.update('r-missing', { estado: 'ativa' }, { userId: 'op-1', role: 'OPERADOR' }),
        isNotFound,
      );
    },
  },
  {
    name: 'operador não pode reatribuir operador/equipa (403)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r-mine', operadorId: 'op-1' })],
        }) as never,
      );

      await assert.rejects(
        () => service.update('r-mine', { operadorId: 'op-2' }, { userId: 'op-1', role: 'OPERADOR' }),
        isForbidden,
      );
    },
  },
  {
    name: 'cidadão não pode atualizar rotas (403)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({ rotas: [buildRota({ id: 'r1' })] }) as never,
      );

      await assert.rejects(
        () => service.update('r1', { estado: 'ativa' }, { userId: 'c-1', role: 'CIDADAO' }),
        isForbidden,
      );
    },
  },
  {
    name: 'gestor atribui operador e o label passa a ser o email do operador',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r1', operador: 'desconhecido' })],
          users: [{ id: 'op-1', email: 'op@ecobairro.local', role: 'OPERADOR', eliminadoEm: null }],
        }) as never,
      );

      const updated = await service.update('r1', { operadorId: 'op-1' }, { userId: 'g-1', role: 'GESTOR' });
      assert.equal(updated.operadorId, 'op-1');
      assert.equal(updated.operador, 'op@ecobairro.local');
    },
  },
  {
    name: 'gestor atribui equipa à rota',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({ rotas: [buildRota({ id: 'r1' })] }) as never,
      );

      const updated = await service.update('r1', { equipaId: 'eq-1' }, { userId: 'g-1', role: 'GESTOR' });
      assert.equal(updated.equipaId, 'eq-1');
    },
  },
  {
    name: 'gestor a atribuir um id que não é operador recebe 404 (utilizador)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r1' })],
          users: [{ id: 'g-2', email: 'gestor@x', role: 'GESTOR', eliminadoEm: null }],
        }) as never,
      );

      await assert.rejects(
        () => service.update('r1', { operadorId: 'g-2' }, { userId: 'g-1', role: 'GESTOR' }),
        (e: Error) => e instanceof NotFoundException && e.message === 'Utilizador não encontrado.',
      );
    },
  },
  {
    name: 'gestor cria rota: persiste e mapeia campos (ecopontos = nº de paragens)',
    run: async () => {
      const service = new RotasService(new FakePrisma({ rotas: [] }) as never);

      const created = await service.create(
        { userId: 'g-1', role: 'GESTOR' },
        buildCreateDto() as never,
      );

      assert.equal(created.nome, 'Rota Centro — gerada');
      assert.equal(created.estado, 'pendente');
      assert.equal(created.zona, 'Centro');
      assert.equal(created.ecopontos, 2); // = paragens.length
      assert.equal(created.paragens.length, 2);
      assert.equal(created.geometria.length, 3);
      assert.equal(created.operadorId, null);

      // Persistiu mesmo (aparece na lista do gestor).
      const lista = await service.list({ userId: 'g-1', role: 'GESTOR' });
      assert.equal(lista.total, 1);
    },
  },
  {
    name: 'operador não pode criar rota (403)',
    run: async () => {
      const service = new RotasService(new FakePrisma({ rotas: [] }) as never);
      await assert.rejects(
        () => service.create({ userId: 'op-1', role: 'OPERADOR' }, buildCreateDto() as never),
        isForbidden,
      );
    },
  },
  {
    name: 'cidadão não pode criar rota (403)',
    run: async () => {
      const service = new RotasService(new FakePrisma({ rotas: [] }) as never);
      await assert.rejects(
        () => service.create({ userId: 'c-1', role: 'CIDADAO' }, buildCreateDto() as never),
        isForbidden,
      );
    },
  },
  {
    name: 'gestor elimina rota: desaparece da lista',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r1' }), buildRota({ id: 'r2' })],
        }) as never,
      );

      await service.remove('r1', { userId: 'g-1', role: 'GESTOR' });

      const lista = await service.list({ userId: 'g-1', role: 'GESTOR' });
      assert.deepEqual(lista.rotas.map((r) => r.id), ['r2']);
      assert.equal(lista.total, 1);
    },
  },
  {
    name: 'admin elimina rota',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({ rotas: [buildRota({ id: 'r1' })] }) as never,
      );

      await service.remove('r1', { userId: 'a-1', role: 'ADMIN' });

      const lista = await service.list({ userId: 'a-1', role: 'ADMIN' });
      assert.equal(lista.total, 0);
    },
  },
  {
    name: 'operador não pode eliminar rota (403)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({
          rotas: [buildRota({ id: 'r1', operadorId: 'op-1' })],
        }) as never,
      );

      await assert.rejects(
        () => service.remove('r1', { userId: 'op-1', role: 'OPERADOR' }),
        isForbidden,
      );
      // Não eliminou.
      const lista = await service.list({ userId: 'g-1', role: 'GESTOR' });
      assert.equal(lista.total, 1);
    },
  },
  {
    name: 'cidadão não pode eliminar rota (403)',
    run: async () => {
      const service = new RotasService(
        new FakePrisma({ rotas: [buildRota({ id: 'r1' })] }) as never,
      );

      await assert.rejects(
        () => service.remove('r1', { userId: 'c-1', role: 'CIDADAO' }),
        isForbidden,
      );
    },
  },
  {
    name: 'gestor a eliminar rota inexistente recebe 404',
    run: async () => {
      const service = new RotasService(new FakePrisma({ rotas: [] }) as never);

      await assert.rejects(
        () => service.remove('r-missing', { userId: 'g-1', role: 'GESTOR' }),
        isNotFound,
      );
    },
  },
];
