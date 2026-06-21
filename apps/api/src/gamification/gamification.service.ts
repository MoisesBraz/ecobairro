import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma, QuizTipo, ReportStatus, UserRole } from '@prisma/client';
import type {
  GamificationOptInResponse,
  QuizAchievement,
  QuizAchievementKey,
  QuizHistoryResponse,
  QuizMeResponse,
  QuizRankingEntry,
  QuizResultItem,
  QuizResultResponse,
  QuizUserStats,
  StartQuizResponse,
  SubmitQuizRequest,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { forbidden, notFound } from '../common/errors';
import { parsePagination } from '../common/pagination';
import { sample, type Rng } from './quiz-random.util';

const ACHIEVEMENTS: Array<{
  key: QuizAchievementKey;
  nome: string;
  desc: string;
}> = [
  { key: 'eco_sabio', nome: 'Eco-Sábio', desc: 'Acertou 10 quizzes seguidos' },
  { key: 'olho_vivo', nome: 'Olho Vivo', desc: 'Primeiro reporte resolvido' },
  { key: 'reciclagem_pro', nome: 'Reciclagem Pro', desc: '100kg reciclados este ano' },
  { key: 'mestre_da_rua', nome: 'Mestre da Rua', desc: 'Ativo em 5 zonas diferentes' },
  { key: 'lenda_urbana', nome: 'Lenda Urbana', desc: 'Ficou no Top 3 do mês' },
  { key: 'benfeitor', nome: 'Benfeitor', desc: '5 partilhas concluídas' },
];

const PONTOS_REPORT_RESOLVIDO = 100;
const PONTOS_PARTILHA = 50;

/** TTL da sessão de quiz no Redis (30 min — RF-19). */
const QUIZ_SESSION_TTL_SECONDS = 1800;
const QUIZ_SESSION_PREFIX = 'quiz:sessao:';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_QUIZ_DURATION_SECONDS = 120;

interface QuizSessionState {
  cidadaoId: string;
  quizId: string;
  tipo: QuizTipo;
  perguntaIds: string[];
  iniciadaEm: string;
}

interface StoredAnswer {
  perguntaId: string;
  opcaoId: string | null;
  correta: boolean;
  pontos: number;
}

function toDateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function computeStreakFromResolvedDates(resolvedDates: Date[]): number {
  if (resolvedDates.length === 0) return 0;
  const unique = new Set(resolvedDates.map(toDateKeyUTC));
  const latest = resolvedDates[0]!;
  const cursor = new Date(toDateKeyUTC(latest) + 'T00:00:00.000Z'); // start at latest date
  let streak = 0;
  while (true) {
    const key = toDateKeyUTC(cursor);
    if (!unique.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Streak de quizzes "perfeitos" consecutivos a partir do mais recente. */
function computeQuizWinStreak(
  sessions: Array<{ respostas: Prisma.JsonValue; totalPerguntas: number }>,
): number {
  let streak = 0;
  for (const s of sessions) {
    const respostas = Array.isArray(s.respostas) ? (s.respostas as unknown as StoredAnswer[]) : [];
    const acertos = respostas.filter((r) => r?.correta === true).length;
    const perfeito = s.totalPerguntas > 0 && acertos === s.totalPerguntas;
    if (!perfeito) break;
    streak += 1;
  }
  return streak;
}

function computeAvatar(nomeCompleto: string | null, email: string): string {
  const fallback = email.split('@')[0] ?? 'U';
  const base = (nomeCompleto ?? fallback).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '?').join('');
  return initials.padEnd(2, '?');
}

function levelFromPoints(pontos: number): { nivel: string; proximoNivel: string; curMin: number; curMax: number } {
  if (pontos < 500) {
    return { nivel: 'Iniciante', proximoNivel: 'Eco-Guerreiro', curMin: 0, curMax: 500 };
  }
  if (pontos < 1000) {
    return { nivel: 'Eco-Guerreiro', proximoNivel: 'Guardião Verde', curMin: 500, curMax: 1000 };
  }
  if (pontos < 1500) {
    return { nivel: 'Guardião Verde', proximoNivel: 'Eco-Guardiões', curMin: 1000, curMax: 1500 };
  }
  return { nivel: 'Eco-Guardiões', proximoNivel: 'Líder da Reciclagem', curMin: 1500, curMax: 2000 };
}

@Injectable()
export class GamificationService {
  private readonly prisma: PrismaService;
  private readonly redis: RedisService;
  /** RNG injetável para tornar o sorteio determinístico em testes. */
  private readonly rng: Rng;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(RedisService) redis: RedisService,
    @Optional() rng?: Rng,
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.rng = rng ?? Math.random;
  }

  // ── Opt-in (G1/G2) ─────────────────────────────────────────────────────

  async setOptIn(user: AuthenticatedUser, value: boolean): Promise<GamificationOptInResponse> {
    this.assertCitizen(user);
    await this.prisma.cidadaoPerfil.update({
      where: { userId: user.userId },
      data: { gamificationOptIn: value },
    });
    return { optedIn: value };
  }

  private assertCitizen(user: AuthenticatedUser): void {
    if (user.role !== UserRole.CIDADAO) {
      throw forbidden('FORBIDDEN');
    }
  }

  private async assertOptIn(userId: string): Promise<void> {
    const perfil = await this.prisma.cidadaoPerfil.findUnique({
      where: { userId },
      select: { gamificationOptIn: true },
    });
    if (!perfil?.gamificationOptIn) {
      throw forbidden('QUIZ_OPT_IN_REQUIRED');
    }
  }

  // ── Jogar o quiz (RF-19) ────────────────────────────────────────────────

  async iniciarQuiz(user: AuthenticatedUser): Promise<StartQuizResponse> {
    this.assertCitizen(user);
    await this.assertOptIn(user.userId);

    const pool = await this.prisma.quiz.findFirst({
      where: { ativo: true },
      orderBy: { criadoEm: 'desc' },
      include: {
        perguntas: {
          include: { opcoes: { orderBy: { ordem: 'asc' } } },
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!pool || pool.perguntas.length === 0) {
      throw notFound('QUIZ_UNAVAILABLE');
    }

    const n = pool.numeroPerguntas > 0 ? pool.numeroPerguntas : 4;
    const sorteadas = sample(pool.perguntas, n, this.rng);

    const sessaoId = randomUUID();
    const iniciadaEm = new Date();
    const state: QuizSessionState = {
      cidadaoId: user.userId,
      quizId: pool.id,
      tipo: pool.tipo,
      perguntaIds: sorteadas.map((p) => p.id),
      iniciadaEm: iniciadaEm.toISOString(),
    };

    await this.redis
      .getClient()
      .set(QUIZ_SESSION_PREFIX + sessaoId, JSON.stringify(state), 'EX', QUIZ_SESSION_TTL_SECONDS);

    const tempoLimiteSeconds = await this.getTempoLimiteSeconds();

    return {
      sessaoId,
      tipo: pool.tipo,
      tempoLimiteSeconds,
      expiraEm: new Date(iniciadaEm.getTime() + QUIZ_SESSION_TTL_SECONDS * MS_PER_SECOND).toISOString(),
      perguntas: sorteadas.map((p) => ({
        id: p.id,
        ordem: p.ordem,
        texto: p.textoPergunta,
        categoria: p.categoria,
        pontos: p.pontos,
        imagemUrl: p.imagemUrl,
        // NUNCA enviar `correta` ao cliente — só no resultado (RF-19).
        opcoes: p.opcoes.map((o) => ({ id: o.id, ordem: o.ordem, texto: o.texto })),
      })),
    };
  }

  async responderQuiz(
    user: AuthenticatedUser,
    sessaoId: string,
    body: SubmitQuizRequest,
  ): Promise<QuizResultResponse> {
    this.assertCitizen(user);
    await this.assertOptIn(user.userId);

    const key = QUIZ_SESSION_PREFIX + sessaoId;
    const raw = await this.redis.getClient().get(key);
    if (!raw) {
      throw notFound('QUIZ_SESSION_NOT_FOUND');
    }

    const state = JSON.parse(raw) as QuizSessionState;
    if (state.cidadaoId !== user.userId) {
      // Não revelar a existência da sessão de outro cidadão.
      throw notFound('QUIZ_SESSION_NOT_FOUND');
    }

    const perguntas = await this.prisma.quizPergunta.findMany({
      where: { id: { in: state.perguntaIds } },
      include: { opcoes: { orderBy: { ordem: 'asc' } } },
      orderBy: { ordem: 'asc' },
    });

    const escolhaPorPergunta = new Map<string, string>();
    for (const r of body.respostas ?? []) {
      escolhaPorPergunta.set(r.perguntaId, r.opcaoId);
    }

    const itens: QuizResultItem[] = [];
    const stored: StoredAnswer[] = [];
    let scoreObtido = 0;
    let acertos = 0;

    for (const p of perguntas) {
      const correcta = p.opcoes.find((o) => o.correta);
      const escolhidaId = escolhaPorPergunta.get(p.id) ?? null;
      const acertou = correcta != null && escolhidaId === correcta.id;
      const pontos = acertou ? p.pontos : 0;
      if (acertou) {
        acertos += 1;
        scoreObtido += pontos;
      }

      stored.push({ perguntaId: p.id, opcaoId: escolhidaId, correta: acertou, pontos });
      itens.push({
        perguntaId: p.id,
        texto: p.textoPergunta,
        opcaoEscolhidaId: escolhidaId,
        opcaoCorretaId: correcta?.id ?? '',
        correta: acertou,
        pontos,
        explicacaoEducativa: p.explicacaoEducativa,
      });
    }

    await this.prisma.quizSessao.create({
      data: {
        cidadaoId: user.userId,
        quizId: state.quizId,
        tipo: state.tipo,
        respostas: stored as unknown as Prisma.InputJsonValue,
        scoreObtido,
        totalPerguntas: perguntas.length,
      },
    });

    await this.redis.getClient().del(key);

    return {
      sessaoId,
      scoreObtido,
      pontosGanhos: scoreObtido,
      totalPerguntas: perguntas.length,
      acertos,
      itens,
    };
  }

  async getHistorico(
    user: AuthenticatedUser,
    page = 1,
    pageSize = 10,
  ): Promise<QuizHistoryResponse> {
    this.assertCitizen(user);
    const { page: safePage, pageSize: safeSize } = parsePagination(page, pageSize, 10, 50);

    const [total, rows] = await Promise.all([
      this.prisma.quizSessao.count({ where: { cidadaoId: user.userId } }),
      this.prisma.quizSessao.findMany({
        where: { cidadaoId: user.userId },
        orderBy: { concluidoEm: 'desc' },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
    ]);

    return {
      total,
      page: safePage,
      pageSize: safeSize,
      itens: rows.map((r) => {
        const respostas = Array.isArray(r.respostas)
          ? (r.respostas as unknown as StoredAnswer[])
          : [];
        return {
          id: r.id,
          tipo: r.tipo,
          scoreObtido: r.scoreObtido,
          totalPerguntas: r.totalPerguntas,
          acertos: respostas.filter((a) => a?.correta === true).length,
          concluidoEm: r.concluidoEm.toISOString(),
        };
      }),
    };
  }

  private async getTempoLimiteSeconds(): Promise<number> {
    const year = new Date().getUTCFullYear();
    const challenge = await this.prisma.quizDesafio.findFirst({
      where: { ativo: true, ano: year },
      orderBy: { criadoEm: 'desc' },
      select: { tempoLimiteMin: true },
    });
    return challenge?.tempoLimiteMin != null ? challenge.tempoLimiteMin * SECONDS_PER_MINUTE : DEFAULT_QUIZ_DURATION_SECONDS;
  }

  // ── Resumo da gamificação (página /quiz) ────────────────────────────────

  async getQuizMe(user: AuthenticatedUser): Promise<QuizMeResponse> {
    this.assertCitizen(user);

    const now = new Date();
    const year = now.getUTCFullYear();

    const [challenge, perfil] = await Promise.all([
      this.prisma.quizDesafio.findFirst({
        where: { ativo: true, ano: year },
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.cidadaoPerfil.findUnique({
        where: { userId: user.userId },
        select: { gamificationOptIn: true },
      }),
    ]);

    const hero = {
      titulo: challenge?.titulo ?? `Herói da Reciclagem ${year}`,
      bonus_xp: challenge?.bonusXp ?? 50,
      tempo_limite_seconds: challenge?.tempoLimiteMin != null ? challenge.tempoLimiteMin * SECONDS_PER_MINUTE : DEFAULT_QUIZ_DURATION_SECONDS,
    };

    const [resolvedCount, resolvedDates, partilhasCount, myQuizScore, quizWinSessions] =
      await Promise.all([
        this.prisma.report.count({
          where: { userId: user.userId, status: ReportStatus.RESOLVIDO },
        }),
        this.prisma.report.findMany({
          where: { userId: user.userId, status: ReportStatus.RESOLVIDO },
          select: { criadoEm: true },
          orderBy: { criadoEm: 'desc' },
        }),
        this.prisma.partilha.count({
          where: { userId: user.userId },
        }),
        this.sumQuizScore(user.userId),
        this.prisma.quizSessao.findMany({
          where: { cidadaoId: user.userId },
          select: { respostas: true, totalPerguntas: true },
          orderBy: { concluidoEm: 'desc' },
          take: 20,
        }),
      ]);

    const streak = computeStreakFromResolvedDates(resolvedDates.map((r) => r.criadoEm));
    const quizWinStreak = computeQuizWinStreak(quizWinSessions);
    const pontos = resolvedCount * PONTOS_REPORT_RESOLVIDO + partilhasCount * PONTOS_PARTILHA + myQuizScore;

    const lvl = levelFromPoints(pontos);
    const faltamPts = Math.max(lvl.curMax - pontos, 0);
    const xp = Math.max(
      0,
      Math.min(100, Math.round(((pontos - lvl.curMin) / Math.max(lvl.curMax - lvl.curMin, 1)) * 100)),
    );

    // Ranking: top cidadãos por pontos (all-time), incluindo score do quiz.
    const citizens = await this.prisma.user.findMany({
      where: { role: UserRole.CIDADAO, eliminadoEm: null },
      select: { id: true, email: true, cidadaoPerfil: { select: { nomeCompleto: true } } },
    });

    const quizScoreByUser = await this.quizScoreByUser();

    const rankings = await Promise.all(
      citizens.map(async (c) => {
        const [rResolved, rPartilhas] = await Promise.all([
          this.prisma.report.count({ where: { userId: c.id, status: ReportStatus.RESOLVIDO } }),
          this.prisma.partilha.count({ where: { userId: c.id } }),
        ]);
        const pontosC =
          rResolved * PONTOS_REPORT_RESOLVIDO +
          rPartilhas * PONTOS_PARTILHA +
          (quizScoreByUser.get(c.id) ?? 0);
        const nome = c.cidadaoPerfil?.nomeCompleto ?? c.email;
        const avatar = computeAvatar(c.cidadaoPerfil?.nomeCompleto ?? null, c.email);
        return { id: c.id, nome, pontos: pontosC, avatar };
      }),
    );

    rankings.sort((a, b) => b.pontos - a.pontos);
    const myIndex = rankings.findIndex((r) => r.id === user.userId);
    const posicao = myIndex >= 0 ? myIndex + 1 : 0;

    const top = rankings.slice(0, 5).map((r) => ({
      id: r.id,
      nome: r.nome,
      pontos: r.pontos,
      avatar: r.avatar,
      isMe: r.id === user.userId,
    })) satisfies QuizRankingEntry[];

    // Monthly ranking for "Lenda Urbana"
    const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(year, now.getUTCMonth() + 1, 1));

    const monthRankings = await Promise.all(
      citizens.map(async (c) => {
        const [rResolvedMonth, pPartilhasMonth] = await Promise.all([
          this.prisma.report.count({
            where: {
              userId: c.id,
              status: ReportStatus.RESOLVIDO,
              criadoEm: { gte: monthStart, lt: monthEnd },
            },
          }),
          this.prisma.partilha.count({
            where: {
              userId: c.id,
              criadoEm: { gte: monthStart, lt: monthEnd },
            },
          }),
        ]);
        const pontosM = rResolvedMonth * PONTOS_REPORT_RESOLVIDO + pPartilhasMonth * PONTOS_PARTILHA;
        return { id: c.id, pontos: pontosM };
      }),
    );

    monthRankings.sort((a, b) => b.pontos - a.pontos);
    const myMonthIndex = monthRankings.findIndex((r) => r.id === user.userId);
    const myMonthRank = myMonthIndex >= 0 ? myMonthIndex + 1 : 999;
    const isTop3Month = myMonthRank <= 3;

    // Extra metrics for achievements.
    const [distinctLocalCount, resolvedKgApprox] = await Promise.all([
      this.prisma.report
        .findMany({
          where: { userId: user.userId, status: ReportStatus.RESOLVIDO },
          select: { local: true },
        })
        .then((rows) => new Set(rows.map((r) => r.local)).size),
      Promise.resolve(resolvedCount * 5),
    ]);

    const conquistas: QuizAchievement[] = ACHIEVEMENTS.map((a) => {
      let unlocked = false;
      switch (a.key) {
        case 'eco_sabio':
          unlocked = quizWinStreak >= 10;
          break;
        case 'olho_vivo':
          unlocked = resolvedCount >= 1;
          break;
        case 'reciclagem_pro':
          unlocked = resolvedKgApprox >= 100;
          break;
        case 'mestre_da_rua':
          unlocked = distinctLocalCount >= 5;
          break;
        case 'lenda_urbana':
          unlocked = isTop3Month;
          break;
        case 'benfeitor':
          unlocked = partilhasCount >= 5;
          break;
      }
      return { key: a.key, nome: a.nome, desc: a.desc, unlocked };
    });

    const userStats: QuizUserStats = {
      pontos,
      nivel: lvl.nivel,
      proximoNivel: lvl.proximoNivel,
      xp,
      faltam_pts: faltamPts,
      streak,
      posicao,
    };

    return {
      hero,
      userStats,
      ranking: top,
      conquistas,
      optedIn: perfil?.gamificationOptIn ?? false,
    };
  }

  private async sumQuizScore(userId: string): Promise<number> {
    const agg = await this.prisma.quizSessao.aggregate({
      where: { cidadaoId: userId },
      _sum: { scoreObtido: true },
    });
    return agg._sum.scoreObtido ?? 0;
  }

  private async quizScoreByUser(): Promise<Map<string, number>> {
    const grouped = await this.prisma.quizSessao.groupBy({
      by: ['cidadaoId'],
      _sum: { scoreObtido: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) {
      map.set(g.cidadaoId, g._sum.scoreObtido ?? 0);
    }
    return map;
  }
}
