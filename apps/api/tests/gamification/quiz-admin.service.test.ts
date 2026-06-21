import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { UserRole } from '@ecobairro/contracts';
import { QuizAdminService } from '../../src/gamification/quiz-admin.service';
import type { AuthenticatedUser } from '../../src/auth/auth.types';
import type { CreateQuizQuestionDto } from '../../src/gamification/dto/create-quiz-question.dto';
import type { UpdateQuizQuestionDto } from '../../src/gamification/dto/update-quiz-question.dto';
import type { TestCase } from '../test-helpers';

const GESTOR: AuthenticatedUser = { userId: 'g1', role: 'GESTOR' as UserRole };
const ADMIN: AuthenticatedUser = { userId: 'a1', role: 'ADMIN' as UserRole };
const CIDADAO: AuthenticatedUser = { userId: 'c1', role: 'CIDADAO' as UserRole };
const OPERADOR: AuthenticatedUser = { userId: 'o1', role: 'OPERADOR' as UserRole };

interface OptionData {
  ordem: number;
  texto: string;
  correta: boolean;
}
interface CreateArgs {
  data: {
    ordem: number;
    quizId: string;
    pontos: number;
    textoPergunta: string;
    explicacaoEducativa: string;
    categoria: string;
    imagemUrl: string | null;
    opcoes: { create: OptionData[] };
  };
}
interface UpdateArgs {
  where: { id: string };
  data: Record<string, unknown>;
}
interface WhereIdArgs {
  where: { id: string };
}
interface DeleteManyArgs {
  where: { perguntaId: string };
}
interface CreateManyArgs {
  data: Array<OptionData & { perguntaId: string }>;
}

class FakeAudit {
  readonly writes: Array<Record<string, unknown>> = [];
  async write(entry: Record<string, unknown>): Promise<void> {
    this.writes.push(entry);
  }
}

class FakePrisma {
  poolId: string | null = 'pool-1';
  maxOrdem: number | null = 5;
  existingPergunta: { id: string; quizId?: string } | null = null;

  created: CreateArgs | null = null;
  updatedData: Record<string, unknown> | null = null;
  optDeleteMany: DeleteManyArgs | null = null;
  optCreateMany: Array<OptionData & { perguntaId: string }> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optUpdates: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optCreates: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optFindManyReturn: any[] = [];
  deletedId: string | null = null;

  readonly quiz = {
    findFirst: async () => (this.poolId ? { id: this.poolId } : null),
  };

  readonly quizPergunta = {
    aggregate: async () => ({ _max: { ordem: this.maxOrdem } }),
    create: async (args: CreateArgs) => {
      this.created = args;
      const d = args.data;
      return {
        id: 'new-q',
        ordem: d.ordem,
        textoPergunta: d.textoPergunta,
        explicacaoEducativa: d.explicacaoEducativa,
        categoria: d.categoria,
        pontos: d.pontos,
        imagemUrl: d.imagemUrl,
        opcoes: d.opcoes.create.map((o, i) => ({
          id: `new-o${i}`,
          ordem: o.ordem,
          texto: o.texto,
          correta: o.correta,
        })),
      };
    },
    findUnique: async () => this.existingPergunta,
    findUniqueOrThrow: async () => ({
      id: 'q-1',
      ordem: 1,
      textoPergunta: 'Pergunta',
      explicacaoEducativa: 'Explicação',
      categoria: 'GERAL',
      pontos: 10,
      imagemUrl: null,
      opcoes: (this.optCreateMany ?? []).map((o, i) => ({
        id: `o${i}`,
        ordem: o.ordem,
        texto: o.texto,
        correta: o.correta,
      })),
    }),
    update: async (args: UpdateArgs) => {
      this.updatedData = args.data;
      return {};
    },
    delete: async (args: WhereIdArgs) => {
      this.deletedId = args.where.id;
      return {};
    },
    findMany: async () => [],
  };

  readonly quizOpcao = {
    deleteMany: async (args: DeleteManyArgs) => {
      this.optDeleteMany = args;
      return { count: 0 };
    },
    createMany: async (args: CreateManyArgs) => {
      this.optCreateMany = args.data;
      return { count: args.data.length };
    },
    findMany: async () => this.optFindManyReturn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: async (args: any) => {
      this.optUpdates.push(args);
      return {};
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: async (args: any) => {
      this.optCreates.push(args);
      return {};
    },
  };

  readonly user = {
    findUnique: async () => ({ email: 'gestor@example.com' }),
  };

  async $transaction<T>(cb: (tx: this) => Promise<T>): Promise<T> {
    return cb(this);
  }
}

function buildService(): { service: QuizAdminService; prisma: FakePrisma; audit: FakeAudit } {
  const prisma = new FakePrisma();
  const audit = new FakeAudit();
  const redis = { getClient: () => ({ del: async () => {} }) };
  const service = new QuizAdminService(prisma as never, audit as never, redis as never);
  return { service, prisma, audit };
}

function createDto(opcoes: Array<{ texto: string; correta: boolean }>): CreateQuizQuestionDto {
  return {
    textoPergunta: 'O que vai para o contentor amarelo?',
    explicacaoEducativa: 'Embalagens de plástico e metal vão para o amarelo.',
    categoria: 'RECICLAGEM',
    opcoes,
  } as CreateQuizQuestionDto;
}

const TWO_VALID = [
  { texto: 'Plástico', correta: true },
  { texto: 'Vidro', correta: false },
];

export const quizAdminServiceTests: TestCase[] = [
  {
    name: 'list refuses CIDADAO callers',
    run: async () => {
      const { service } = buildService();
      await assert.rejects(() => service.list(CIDADAO), ForbiddenException);
    },
  },
  {
    name: 'create refuses OPERADOR callers',
    run: async () => {
      const { service } = buildService();
      await assert.rejects(
        () => service.create(OPERADOR, '1.1.1.1', createDto(TWO_VALID)),
        ForbiddenException,
      );
    },
  },
  {
    name: 'create assigns ordem = max+1, defaults pontos to 10, audits (GESTOR)',
    run: async () => {
      const { service, prisma, audit } = buildService();
      const result = await service.create(GESTOR, '1.1.1.1', createDto(TWO_VALID));

      assert.equal(result.ordem, 6); // maxOrdem 5 + 1
      assert.equal(prisma.created?.data.ordem, 6);
      assert.equal(prisma.created?.data.quizId, 'pool-1');
      assert.equal(prisma.created?.data.pontos, 10); // default
      assert.equal(result.opcoes.length, 2);
      assert.equal(audit.writes.length, 1);
      assert.equal(audit.writes[0]!.acao, 'create');
      assert.equal(audit.writes[0]!.papel, 'gestor');
    },
  },
  {
    name: 'create ordem is 1 on an empty pool',
    run: async () => {
      const { service, prisma } = buildService();
      prisma.maxOrdem = null;
      const result = await service.create(ADMIN, '1.1.1.1', createDto(TWO_VALID));
      assert.equal(result.ordem, 1);
      assert.equal(prisma.created?.data.pontos, 10);
    },
  },
  {
    name: 'create rejects when no option is correct',
    run: async () => {
      const { service } = buildService();
      await assert.rejects(
        () =>
          service.create(GESTOR, '1.1.1.1', createDto([
            { texto: 'A', correta: false },
            { texto: 'B', correta: false },
          ])),
        BadRequestException,
      );
    },
  },
  {
    name: 'create rejects when more than one option is correct',
    run: async () => {
      const { service } = buildService();
      await assert.rejects(
        () =>
          service.create(GESTOR, '1.1.1.1', createDto([
            { texto: 'A', correta: true },
            { texto: 'B', correta: true },
          ])),
        BadRequestException,
      );
    },
  },
  {
    name: 'create throws QUIZ_UNAVAILABLE when there is no active pool',
    run: async () => {
      const { service, prisma } = buildService();
      prisma.poolId = null;
      await assert.rejects(
        () => service.create(GESTOR, '1.1.1.1', createDto(TWO_VALID)),
        NotFoundException,
      );
    },
  },
  {
    name: 'update replaces options (deleteMany + createMany) inside a transaction',
    run: async () => {
      const { service, prisma } = buildService();
      prisma.existingPergunta = { id: 'q-1', quizId: 'pool-1' };
      prisma.optFindManyReturn = [{ id: 'opt-old-1' }];
      const dto: UpdateQuizQuestionDto = {
        textoPergunta: 'Pergunta editada',
        opcoes: TWO_VALID,
      } as UpdateQuizQuestionDto;

      await service.update(GESTOR, '1.1.1.1', 'q-1', dto);

      assert.equal(prisma.updatedData?.textoPergunta, 'Pergunta editada');
      assert.equal(prisma.optUpdates.length, 1);
      assert.equal(prisma.optUpdates[0].where.id, 'opt-old-1');
      assert.equal(prisma.optCreates.length, 1);
    },
  },
  {
    name: 'update rejects invalid option sets',
    run: async () => {
      const { service, prisma } = buildService();
      prisma.existingPergunta = { id: 'q-1', quizId: 'pool-1' };
      await assert.rejects(
        () =>
          service.update(GESTOR, '1.1.1.1', 'q-1', {
            opcoes: [
              { texto: 'A', correta: true },
              { texto: 'B', correta: true },
            ],
          } as UpdateQuizQuestionDto),
        BadRequestException,
      );
    },
  },
  {
    name: 'update throws NOT_FOUND for a missing question',
    run: async () => {
      const { service, prisma } = buildService();
      prisma.existingPergunta = null;
      await assert.rejects(
        () => service.update(GESTOR, '1.1.1.1', 'missing', {} as UpdateQuizQuestionDto),
        NotFoundException,
      );
    },
  },
  {
    name: 'remove deletes the question and audits (ADMIN papel)',
    run: async () => {
      const { service, prisma, audit } = buildService();
      prisma.existingPergunta = { id: 'q-1', quizId: 'pool-1' };
      const result = await service.remove(ADMIN, '1.1.1.1', 'q-1');
      assert.deepEqual(result, { id: 'q-1', removed: true });
      assert.equal(prisma.deletedId, 'q-1');
      assert.equal(audit.writes[0]!.papel, 'admin');
      assert.equal(audit.writes[0]!.acao, 'delete');
    },
  },
  {
    name: 'remove throws NOT_FOUND for a missing question',
    run: async () => {
      const { service, prisma } = buildService();
      prisma.existingPergunta = null;
      await assert.rejects(
        () => service.remove(GESTOR, '1.1.1.1', 'missing'),
        NotFoundException,
      );
    },
  },
];
