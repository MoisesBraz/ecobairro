import assert from 'node:assert/strict';
import { ReportStatus, UserRole } from '@prisma/client';
import { HomeService } from '../../src/home/home.service';
import type { TestCase } from '../test-helpers';

const ecoRow = {
  id: 'e1',
  nome: 'Eco A',
  distanciaLabel: '100 m',
  contentores: [{ tipo: 'Papel', ocupacao: 85, sensorEstado: 'online' }],
  mapTileUrl: 'https://example.com/t.png',
  ordem: 0,
  ativo: true,
  criadoEm: new Date(),
};

const partilhaRow = {
  id: 'p1',
  titulo: 'Mesa',
  autorNome: 'Maria',
  zona: 'Centro',
  userId: null as string | null,
  criadoEm: new Date(),
};

const noticiaRow = {
  id: 'n1',
  titulo: 'Campanha',
  resumo: 'Resumo',
  imagemUrl: 'https://example.com/i.jpg',
  publishedAt: new Date('2026-01-15T10:00:00.000Z'),
  tempoLeituraMin: 5,
};

class FakePrismaService {
  readonly user = {
    count: async (args: { where: { role?: UserRole } }) => {
      if (args.where.role === UserRole.CIDADAO) {
        return 1200;
      }

      return 0;
    },
    findUnique: async (args: { where: { id: string } }) => ({
      id: args.where.id,
      email: 'cidadao@eco.pt',
      role: 'CIDADAO',
      cidadaoPerfil: { nomeCompleto: 'Cidadao Teste' },
    }),
  };

  readonly cidadaoEcopontoFavorito = {
    findMany: async (args: {
      where: { userId: string };
      include: { ecoponto: true };
    }) => {
      assert.equal(args.where.userId, 'u1');
      return [{ ecoponto: ecoRow }];
    },
  };

  readonly partilha = {
    findMany: async (args?: { where?: { OR: Array<{ userId: string | null }> } }) => {
      if (args?.where?.OR) {
        assert.deepEqual(args.where.OR, [{ userId: 'u1' }, { userId: null }]);
      }

      return [partilhaRow];
    },
  };

  readonly noticia = {
    findMany: async () => [noticiaRow],
  };

  readonly report = {
    count: async (args: {
      where: { userId?: string; status?: ReportStatus };
    }) => {
      if (args.where.userId === 'u1' && args.where.status === ReportStatus.RESOLVIDO) {
        return 2;
      }

      if (args.where.userId === 'u1') {
        return 5;
      }

      return 0;
    },
  };
}

export const homeServiceTests: TestCase[] = [
  {
    name: 'getFeed returns lists and citizen metrics for CIDADAO',
    run: async () => {
      const service = new HomeService(new FakePrismaService() as never);
      const out = await service.getFeed({
        userId: 'u1',
        role: 'CIDADAO',
      });

      assert.equal(out.ecopontos.length, 1);
      assert.equal(out.ecopontos[0]?.nome, 'Eco A');
      assert.equal(out.partilhas[0]?.utilizador, 'Maria');
      assert.equal(out.noticias[0]?.titulo, 'Campanha');
      assert.ok(out.alerta);
      assert.equal(out.alerta?.ocupacao, 85);
      assert.equal(out.viewer?.id, 'u1');
      assert.equal(out.viewer?.nome, 'Cidadao Teste');
      assert.equal(out.reports.total, 5);
      assert.equal(out.reports.resolvidos, 2);
      assert.equal(out.reports.ativos, 3);
      assert.equal(out.impacto.reciclagem_kg, 10);
      assert.equal(out.impacto.comunidade_pax, 1200);
      assert.equal(out.impacto.arvores_equivalentes, 1);
    },
  },
  {
    name: 'getFeed skips personal report counts for anonymous user',
    run: async () => {
      const service = new HomeService(new FakePrismaService() as never);
      const out = await service.getFeed(null);

      assert.equal(out.reports.total, 0);
      assert.equal(out.gamification.pontos, 0);
      assert.equal(out.viewer, null);
    },
  },
];
