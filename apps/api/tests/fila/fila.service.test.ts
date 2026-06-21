import assert from 'node:assert/strict';
import { FilaService } from '../../src/fila/fila.service';
import type { TestCase } from '../test-helpers';

interface RawTarefaRow {
  id: string;
  titulo: string;
  local: string;
  tipo: string;
  prioridade: string;
  estado: string;
  atribuido: string | null;
  criadoEm: Date;
}

/**
 * Fake do PrismaService para a fila. O serviço usa `$queryRaw` duas vezes por
 * `list()`: 1.ª para as linhas (LIMIT/OFFSET + ORDER BY prioridade, feito na
 * BD), 2.ª para o COUNT. O fake distingue pela ordem de chamada — a ordenação e
 * o slice são lógica SQL, validados em integração, não aqui.
 */
class FakePrismaFila {
  private readonly rows: RawTarefaRow[];
  private call = 0;

  constructor(rows: RawTarefaRow[]) {
    this.rows = rows;
  }

  $queryRaw = async (): Promise<unknown[]> => {
    this.call += 1;
    if (this.call % 2 === 1) {
      return this.rows.map((r) => ({ ...r }));
    }
    return [{ count: BigInt(this.rows.length) }];
  };

  readonly tarefa = {
    update: async (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const row = this.rows.find((r) => r.id === args.where.id);
      if (!row) throw new Error('P2025');
      return { ...row, ...args.data };
    },
  };
}

function row(overrides: Partial<RawTarefaRow> = {}): RawTarefaRow {
  return {
    id: overrides.id ?? 't-1',
    titulo: overrides.titulo ?? 'Ecoponto cheio',
    local: overrides.local ?? 'Rua A',
    tipo: overrides.tipo ?? 'Ecoponto Cheio',
    prioridade: overrides.prioridade ?? 'normal',
    estado: overrides.estado ?? 'pendente',
    atribuido: overrides.atribuido ?? null,
    criadoEm: overrides.criadoEm ?? new Date('2026-01-01T10:00:00.000Z'),
  };
}

export const filaServiceTests: TestCase[] = [
  {
    name: 'list shapes the paginated response and maps criado_em to ISO',
    run: async () => {
      const prisma = new FakePrismaFila([
        row({ id: 'a', prioridade: 'critica' }),
        row({ id: 'b', prioridade: 'baixa' }),
      ]);
      const service = new FilaService(prisma as never);

      const res = await service.list('GESTOR' as never, { page: 2, pageSize: 5 });
      assert.equal(res.page, 2);
      assert.equal(res.pageSize, 5);
      assert.equal(res.total, 2);
      assert.equal(res.tarefas.length, 2);
      assert.equal(res.tarefas[0]!.criado_em, '2026-01-01T10:00:00.000Z');
    },
  },
  {
    name: 'list defaults to page 1 / pageSize 10 when omitted',
    run: async () => {
      const prisma = new FakePrismaFila([row({ id: 'a' })]);
      const service = new FilaService(prisma as never);

      const res = await service.list('GESTOR' as never, {});
      assert.equal(res.page, 1);
      assert.equal(res.pageSize, 10);
      assert.equal(res.total, 1);
    },
  },
  {
    name: 'update applies fields and returns mapped record',
    run: async () => {
      const prisma = new FakePrismaFila([row({ id: 'x', estado: 'pendente' })]);
      const service = new FilaService(prisma as never);

      const updated = await service.update('GESTOR' as never, 'x', { estado: 'resolvido', atribuido: 'Ana' });
      assert.equal(updated.estado, 'resolvido');
      assert.equal(updated.atribuido, 'Ana');
      assert.equal(updated.id, 'x');
    },
  },
  {
    name: 'blocks list and update for non-manager roles',
    run: async () => {
      const prisma = new FakePrismaFila([row({ id: 'a' })]);
      const service = new FilaService(prisma as never);

      await assert.rejects(() => service.list('CIDADAO' as never, {}));
      await assert.rejects(() => service.list('OPERADOR' as never, {}));
      await assert.rejects(() => service.update('CIDADAO' as never, 'a', { estado: 'resolvido' }));
    },
  },
];
