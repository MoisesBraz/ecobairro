import assert from 'node:assert/strict';
import type { UserRole } from '@ecobairro/contracts';
import { GamificationService } from '../../src/gamification/gamification.service';
import { sample, shuffle } from '../../src/gamification/quiz-random.util';
import type { AuthenticatedUser } from '../../src/auth/auth.types';
import type { TestCase } from '../test-helpers';

const CIDADAO: AuthenticatedUser = { userId: 'u1', role: 'CIDADAO' as UserRole };

function pergunta(id: string, correctOptId: string) {
  return {
    id,
    ordem: Number(id.replace('p', '')),
    textoPergunta: `Pergunta ${id}`,
    explicacaoEducativa: `Explicação ${id}`,
    categoria: 'RECICLAGEM',
    pontos: 10,
    imagemUrl: null,
    opcoes: [
      { id: `${id}o1`, ordem: 1, texto: 'A', correta: `${id}o1` === correctOptId },
      { id: `${id}o2`, ordem: 2, texto: 'B', correta: `${id}o2` === correctOptId },
    ],
  };
}

const POOL_PERGUNTAS = [
  pergunta('p1', 'p1o1'),
  pergunta('p2', 'p2o2'),
  pergunta('p3', 'p3o1'),
];

const POOL = {
  id: 'quiz1',
  tipo: 'SEMANAL',
  numeroPerguntas: 2,
  perguntas: POOL_PERGUNTAS,
};

class FakeRedisClient {
  readonly store = new Map<string, string>();
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
}

class FakeRedis {
  readonly client = new FakeRedisClient();
  getClient(): FakeRedisClient {
    return this.client;
  }
}

class FakePrisma {
  optedIn = true;
  readonly created: Array<Record<string, unknown>> = [];
  historico: Array<Record<string, unknown>> = [];

  readonly cidadaoPerfil = {
    findUnique: async () => ({ gamificationOptIn: this.optedIn }),
    update: async () => ({}),
  };

  readonly quizDesafio = {
    findFirst: async () => null,
  };

  readonly quiz = {
    findFirst: async () => POOL,
  };

  readonly quizPergunta = {
    findMany: async (args: { where: { id: { in: string[] } } }) =>
      POOL_PERGUNTAS.filter((p) => args.where.id.in.includes(p.id)),
  };

  readonly quizSessao = {
    create: async (args: { data: Record<string, unknown> }) => {
      this.created.push(args.data);
      return { id: 's1', ...args.data };
    },
    count: async () => this.historico.length,
    findMany: async () => this.historico,
    aggregate: async () => ({ _sum: { scoreObtido: 0 } }),
    groupBy: async () => [],
  };
}

function buildService(prisma: FakePrisma, redis: FakeRedis, rng: () => number = () => 0) {
  return new GamificationService(prisma as never, redis as never, rng);
}

export const gamificationServiceTests: TestCase[] = [
  {
    name: 'shuffle: determinístico com RNG fixo e não muta o original',
    run: () => {
      const orig = [1, 2, 3, 4, 5];
      const out = shuffle(orig, () => 0);
      assert.equal(out.length, 5);
      assert.deepEqual(orig, [1, 2, 3, 4, 5]);
      assert.deepEqual(shuffle(orig, () => 0), out); // mesmo RNG → mesmo resultado
    },
  },
  {
    name: 'sample: devolve no máximo N elementos distintos',
    run: () => {
      const out = sample([1, 2, 3, 4, 5], 3, () => 0.5);
      assert.equal(out.length, 3);
      assert.equal(new Set(out).size, 3);
      assert.equal(sample([1, 2], 5, () => 0).length, 2); // pool menor que N
    },
  },
  {
    name: 'iniciarQuiz: opt-in em falta devolve 403',
    run: async () => {
      const prisma = new FakePrisma();
      prisma.optedIn = false;
      const svc = buildService(prisma, new FakeRedis());
      await assert.rejects(() => svc.iniciarQuiz(CIDADAO), /./);
    },
  },
  {
    name: 'iniciarQuiz: devolve N perguntas sem campo `correta` e cria sessão Redis',
    run: async () => {
      const prisma = new FakePrisma();
      const redis = new FakeRedis();
      const svc = buildService(prisma, redis);
      const res = await svc.iniciarQuiz(CIDADAO);

      assert.equal(res.perguntas.length, POOL.numeroPerguntas);
      assert.equal(res.tempoLimiteSeconds, 120); // sem QuizDesafio → fallback
      for (const p of res.perguntas) {
        for (const o of p.opcoes) {
          assert.ok(!('correta' in o), 'opção não pode expor `correta`');
        }
      }
      assert.equal(redis.getClient().store.size, 1);
    },
  },
  {
    name: 'responderQuiz: pontua corretamente, persiste e apaga a sessão',
    run: async () => {
      const prisma = new FakePrisma();
      const redis = new FakeRedis();
      const sessaoId = 'sess-1';
      redis.getClient().store.set(
        `quiz:sessao:${sessaoId}`,
        JSON.stringify({
          cidadaoId: 'u1',
          quizId: 'quiz1',
          tipo: 'SEMANAL',
          perguntaIds: ['p1', 'p2', 'p3'],
          iniciadaEm: new Date().toISOString(),
        }),
      );
      const svc = buildService(prisma, redis);
      const res = await svc.responderQuiz(CIDADAO, sessaoId, {
        respostas: [
          { perguntaId: 'p1', opcaoId: 'p1o1' }, // correta
          { perguntaId: 'p2', opcaoId: 'p2o1' }, // errada
          { perguntaId: 'p3', opcaoId: 'p3o1' }, // correta
        ],
      });

      assert.equal(res.acertos, 2);
      assert.equal(res.scoreObtido, 20);
      assert.equal(res.pontosGanhos, 20);
      assert.equal(res.totalPerguntas, 3);
      // Feedback educativo presente em todas as perguntas.
      assert.ok(res.itens.every((i) => i.explicacaoEducativa.length > 0));
      // Sessão persistida e chave Redis apagada.
      assert.equal(prisma.created.length, 1);
      assert.equal(redis.getClient().store.size, 0);
    },
  },
  {
    name: 'responderQuiz: sessão inexistente/expirada devolve erro',
    run: async () => {
      const svc = buildService(new FakePrisma(), new FakeRedis());
      await assert.rejects(
        () => svc.responderQuiz(CIDADAO, 'nao-existe', { respostas: [] }),
        /./,
      );
    },
  },
  {
    name: 'responderQuiz: sessão de outro cidadão não é aceite',
    run: async () => {
      const redis = new FakeRedis();
      const sessaoId = 'sess-x';
      redis.getClient().store.set(
        `quiz:sessao:${sessaoId}`,
        JSON.stringify({
          cidadaoId: 'OUTRO',
          quizId: 'quiz1',
          tipo: 'SEMANAL',
          perguntaIds: ['p1'],
          iniciadaEm: new Date().toISOString(),
        }),
      );
      const svc = buildService(new FakePrisma(), redis);
      await assert.rejects(
        () => svc.responderQuiz(CIDADAO, sessaoId, { respostas: [] }),
        /./,
      );
    },
  },
  {
    name: 'getHistorico: mapeia acertos a partir das respostas guardadas',
    run: async () => {
      const prisma = new FakePrisma();
      prisma.historico = [
        {
          id: 'h1',
          tipo: 'SEMANAL',
          scoreObtido: 20,
          totalPerguntas: 3,
          concluidoEm: new Date('2026-06-01T10:00:00.000Z'),
          respostas: [
            { perguntaId: 'p1', opcaoId: 'p1o1', correta: true, pontos: 10 },
            { perguntaId: 'p2', opcaoId: 'p2o1', correta: false, pontos: 0 },
            { perguntaId: 'p3', opcaoId: 'p3o1', correta: true, pontos: 10 },
          ],
        },
      ];
      const svc = buildService(prisma, new FakeRedis());
      const res = await svc.getHistorico(CIDADAO, 1, 10);
      assert.equal(res.total, 1);
      assert.equal(res.itens[0]?.acertos, 2);
      assert.equal(res.itens[0]?.scoreObtido, 20);
    },
  },
];
