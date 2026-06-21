import assert from 'node:assert/strict';
import { CampanhasService } from '../../src/campanhas/campanhas.service';
import type { TestCase } from '../test-helpers';

interface FakeCampanhaRow {
  id: string;
  titulo: string;
  corpo: string;
  estado: string;
  dataValidade: Date;
  autor: string;
  criadoEm: Date;
}

class FakePrismaCampanhas {
  private store: FakeCampanhaRow[];
  private nextId = 1;

  constructor(initial: FakeCampanhaRow[] = []) {
    this.store = initial.map((c) => ({ ...c }));
  }

  readonly campanha = {
    findMany: async () => this.store.map((c) => ({ ...c })),
    count: async () => this.store.length,
    create: async (args: {
      data: { titulo: string; corpo: string; dataValidade: Date; autor: string };
    }) => {
      const row: FakeCampanhaRow = {
        id: `camp-${this.nextId++}`,
        titulo: args.data.titulo,
        corpo: args.data.corpo,
        estado: 'rascunho',
        dataValidade: args.data.dataValidade,
        autor: args.data.autor,
        criadoEm: new Date('2026-05-01T10:00:00.000Z'),
      };
      this.store.push(row);
      return { ...row };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = this.store.find((c) => c.id === args.where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, args.data);
      return { ...row };
    },
  };

  readonly user = {
    findUnique: async () => ({ email: 'gestor@aveiro.pt', cidadaoPerfil: null }),
  };

  async $transaction<T>(input: Promise<T>[]): Promise<T[]> {
    return Promise.all(input);
  }
}

export const campanhasServiceTests: TestCase[] = [
  {
    name: 'blocks list/create/update for non-manager roles',
    run: async () => {
      const service = new CampanhasService(new FakePrismaCampanhas() as never);
      await assert.rejects(() => service.list('CIDADAO' as never, {}));
      await assert.rejects(() => service.list('OPERADOR' as never, {}));
      await assert.rejects(() =>
        service.create('CIDADAO' as never, { titulo: 'X', corpo: 'Y', dataValidade: '2026-06-01' }, 'u1'),
      );
      await assert.rejects(() => service.update('CIDADAO' as never, 'c1', { estado: 'publicada' }));
    },
  },
  {
    name: 'lists campanhas for manager role',
    run: async () => {
      const service = new CampanhasService(
        new FakePrismaCampanhas([
          {
            id: 'c1',
            titulo: 'Reciclar',
            corpo: 'x',
            estado: 'publicada',
            dataValidade: new Date('2026-06-01T00:00:00.000Z'),
            autor: 'Câmara',
            criadoEm: new Date('2026-05-01T10:00:00.000Z'),
          },
        ]) as never,
      );
      const res = await service.list('GESTOR' as never, {});
      assert.equal(res.total, 1);
    },
  },
  {
    name: 'allows create for manager role',
    run: async () => {
      const service = new CampanhasService(new FakePrismaCampanhas() as never);
      const created = await service.create(
        'GESTOR' as never,
        { titulo: 'Campanha Verde', corpo: 'Conteúdo', dataValidade: '2026-06-01' },
        'gestor-1',
      );
      assert.equal(created.titulo, 'Campanha Verde');
    },
  },
];
