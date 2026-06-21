import { Inject, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type {
  AdminQuizOptionInput,
  AdminQuizQuestion,
  ListAdminQuizQuestionsResponse,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { badRequest, forbidden, notFound } from '../common/errors';
import type { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import type { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';
import { RedisService } from '../redis/redis.service';

/** Pergunta com opções tal como sai do Prisma (com `correta`). */
type QuestionWithOptions = Prisma.QuizPerguntaGetPayload<{
  include: { opcoes: true };
}>;

/**
 * Gestão de perguntas do quiz reservada a GESTOR/ADMIN. Opera sobre o pool
 * ativo único ("Banco de Perguntas EcoBairro"). Controlo de acesso ao nível do
 * service (`assertManager`), seguindo o padrão de `AdminService.assertAdmin`.
 *
 * Invariantes preservadas: exatamente 1 opção correta por pergunta; `correta`
 * NUNCA é exposto ao cidadão durante o jogo (esta vista é só de gestão);
 * `explicacaoEducativa` obrigatória (RF-19).
 */
@Injectable()
export class QuizAdminService {
  private readonly prisma: PrismaService;
  private readonly auditService: AuditService;
  private readonly redis: RedisService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(AuditService) auditService: AuditService,
    @Inject(RedisService) redis: RedisService,
  ) {
    this.prisma = prisma;
    this.auditService = auditService;
    this.redis = redis;
  }

  async list(caller: AuthenticatedUser): Promise<ListAdminQuizQuestionsResponse> {
    this.assertManager(caller.role);
    const pool = await this.resolveActivePool();
    const perguntas = await this.prisma.quizPergunta.findMany({
      where: { quizId: pool.id },
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
      orderBy: { ordem: 'asc' },
    });
    return { itens: perguntas.map(mapQuestion), total: perguntas.length };
  }

  async create(
    caller: AuthenticatedUser,
    ip: string,
    dto: CreateQuizQuestionDto,
  ): Promise<AdminQuizQuestion> {
    this.assertManager(caller.role);
    this.validateOpcoes(dto.opcoes);
    const pool = await this.resolveActivePool();

    const agg = await this.prisma.quizPergunta.aggregate({
      where: { quizId: pool.id },
      _max: { ordem: true },
    });
    const nextOrdem = (agg._max.ordem ?? 0) + 1;

    const created = await this.prisma.quizPergunta.create({
      data: {
        quizId: pool.id,
        ordem: nextOrdem,
        textoPergunta: dto.textoPergunta,
        explicacaoEducativa: dto.explicacaoEducativa,
        categoria: dto.categoria,
        pontos: dto.pontos ?? 10,
        imagemUrl: dto.imagemUrl ?? null,
        opcoes: {
          create: dto.opcoes.map((o, i) => ({
            ordem: i + 1,
            texto: o.texto,
            correta: o.correta,
          })),
        },
      },
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
    });

    await this.audit(caller, ip, 'create', `Criou a pergunta de quiz "${dto.textoPergunta}".`);
    await this.invalidateCache(pool.id);
    return mapQuestion(created);
  }

  async update(
    caller: AuthenticatedUser,
    ip: string,
    id: string,
    dto: UpdateQuizQuestionDto,
  ): Promise<AdminQuizQuestion> {
    this.assertManager(caller.role);

    const pool = await this.resolveActivePool();
    const existing = await this.prisma.quizPergunta.findUnique({ where: { id } });
    if (!existing || existing.quizId !== pool.id) {
      throw notFound('NOT_FOUND');
    }
    if (dto.opcoes) {
      this.validateOpcoes(dto.opcoes);
    }

    const data: Prisma.QuizPerguntaUpdateInput = {};
    if (dto.textoPergunta !== undefined) data.textoPergunta = dto.textoPergunta;
    if (dto.explicacaoEducativa !== undefined) data.explicacaoEducativa = dto.explicacaoEducativa;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.pontos !== undefined) data.pontos = dto.pontos;
    if (dto.imagemUrl !== undefined) data.imagemUrl = dto.imagemUrl ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.quizPergunta.update({ where: { id }, data });
      if (dto.opcoes) {
        // Atualização por ordem para preservar IDs das opções (evitando quebrar sessões ativas)
        const existentes = await tx.quizOpcao.findMany({ where: { perguntaId: id }, orderBy: { ordem: 'asc' } });
        
        for (let i = 0; i < dto.opcoes.length; i++) {
          const opt = dto.opcoes[i]!;
          if (i < existentes.length) {
            await tx.quizOpcao.update({
              where: { id: existentes[i]!.id },
              data: { texto: opt.texto, correta: opt.correta, ordem: i + 1 },
            });
          } else {
            await tx.quizOpcao.create({
              data: { perguntaId: id, texto: opt.texto, correta: opt.correta, ordem: i + 1 },
            });
          }
        }
        
        if (existentes.length > dto.opcoes.length) {
          const paraApagar = existentes.slice(dto.opcoes.length).map((o) => o.id);
          await tx.quizOpcao.deleteMany({ where: { id: { in: paraApagar } } });
        }
      }
      return tx.quizPergunta.findUniqueOrThrow({
        where: { id },
        include: { opcoes: { orderBy: { ordem: 'asc' } } },
      });
    });

    await this.audit(caller, ip, 'update', `Editou a pergunta de quiz ${id}.`);
    await this.invalidateCache(pool.id);
    return mapQuestion(updated);
  }

  async remove(
    caller: AuthenticatedUser,
    ip: string,
    id: string,
  ): Promise<{ id: string; removed: boolean }> {
    this.assertManager(caller.role);

    const pool = await this.resolveActivePool();
    const existing = await this.prisma.quizPergunta.findUnique({ where: { id } });
    if (!existing || existing.quizId !== pool.id) {
      throw notFound('NOT_FOUND');
    }

    // Cascade apaga as opções (FK onDelete: Cascade no schema).
    await this.prisma.quizPergunta.delete({ where: { id } });
    await this.audit(caller, ip, 'delete', `Apagou a pergunta de quiz ${id}.`);
    await this.invalidateCache(pool.id);
    return { id, removed: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private assertManager(role: UserRole): void {
    if (role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
      throw forbidden('FORBIDDEN');
    }
  }

  /** Resolve o pool ativo único; erro se não existir (correr seed). */
  private async resolveActivePool(): Promise<{ id: string }> {
    const pool = await this.prisma.quiz.findFirst({
      where: { ativo: true },
      orderBy: { criadoEm: 'desc' },
      select: { id: true },
    });
    if (!pool) {
      throw notFound('QUIZ_UNAVAILABLE');
    }
    return pool;
  }

  /** Invariante de negócio: 2-6 opções e exatamente 1 correta. */
  private validateOpcoes(opcoes: AdminQuizOptionInput[]): void {
    if (opcoes.length < 2 || opcoes.length > 6) {
      throw badRequest('VALIDATION_ERROR', 'A pergunta deve ter entre 2 e 6 opções.');
    }
    const corretas = opcoes.filter((o) => o.correta).length;
    if (corretas !== 1) {
      throw badRequest('VALIDATION_ERROR', 'A pergunta deve ter exatamente uma opção correta.');
    }
  }

  private async audit(
    caller: AuthenticatedUser,
    ip: string,
    acao: 'create' | 'update' | 'delete',
    descricao: string,
  ): Promise<void> {
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: caller.userId },
        select: { email: true },
      });
      await this.auditService.write({
        utilizador: u?.email ?? caller.userId,
        papel: caller.role === UserRole.ADMIN ? 'admin' : 'gestor',
        acao,
        descricao,
        ip,
      });
    } catch {
      // Auditoria é best-effort — nunca deve impedir a ação principal.
    }
  }

  private async invalidateCache(poolId: string): Promise<void> {
    try {
      await this.redis.getClient().del('quiz:atual:SEMANAL', 'quiz:atual:DIARIO', `quiz:${poolId}:perguntas`);
    } catch {
      // Best effort
    }
  }
}

function mapQuestion(p: QuestionWithOptions): AdminQuizQuestion {
  return {
    id: p.id,
    ordem: p.ordem,
    textoPergunta: p.textoPergunta,
    explicacaoEducativa: p.explicacaoEducativa,
    categoria: p.categoria,
    pontos: p.pontos,
    imagemUrl: p.imagemUrl,
    opcoes: [...p.opcoes]
      .sort((a, b) => a.ordem - b.ordem)
      .map((o) => ({ id: o.id, ordem: o.ordem, texto: o.texto, correta: o.correta })),
  };
}
