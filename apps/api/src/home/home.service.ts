import { Inject, Injectable } from '@nestjs/common';
import { ReportStatus, UserRole } from '@prisma/client';
import type { HomeFeedResponse, PublicStatsResponse } from '@ecobairro/contracts';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

const datePt = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const ECOPONTO_ALERT_THRESHOLD = 80;

const PERCENTAGE_FACTOR = 100;
const GAMIFICATION_MAX_POINTS = 500;
const PTS_PER_RESOLVED_REPORT = 80;
const PTS_PER_ACTIVE_REPORT = 15;
const PTS_ADVANCED_LEVEL_THRESHOLD = 400;
const KG_RECYCLED_PER_REPORT = 5;
const REPORTS_PER_TREE = 2;

@Injectable()
export class HomeService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getPublicStats(): Promise<PublicStatsResponse> {
    const [ecopontosAtivos, cidadaosTotal, totalReports, resolvidos] =
      await this.prisma.$transaction([
        this.prisma.ecoponto.count({ where: { ativo: true } }),
        this.prisma.user.count({
          where: { role: UserRole.CIDADAO, eliminadoEm: null },
        }),
        this.prisma.report.count(),
        this.prisma.report.count({ where: { status: ReportStatus.RESOLVIDO } }),
      ]);

    const taxaResolucao =
      totalReports > 0 ? Math.round((resolvidos / totalReports) * PERCENTAGE_FACTOR) : 0;

    return {
      ecopontos_ativos: ecopontosAtivos,
      cidadaos_total: cidadaosTotal,
      taxa_resolucao: taxaResolucao,
    };
  }

  async getFeed(user: AuthenticatedUser | null): Promise<HomeFeedResponse> {
    const isCitizen = user?.role === 'CIDADAO';
    const currentUser =
      user == null
        ? null
        : await this.prisma.user.findUnique({
            where: { id: user.userId },
            include: { cidadaoPerfil: true },
          });

    const [ecopontos, partilhas, noticias, comunidadePax] = await Promise.all([
      isCitizen && user
        ? this.prisma.cidadaoEcopontoFavorito
            .findMany({
              where: { userId: user.userId, ecoponto: { ativo: true } },
              include: { ecoponto: { include: { contentores: true } } },
              orderBy: { criadoEm: 'asc' },
            })
            .then((rows) => rows.map((row) => ({
               ...row.ecoponto,
               ocupacao: row.ecoponto.contentores.length > 0 
                  ? Math.max(...row.ecoponto.contentores.map((c) => c.ocupacao)) 
                  : 0
            })))
        : Promise.resolve([]),
      this.prisma.partilha.findMany({
        where:
          user == null
            ? undefined
            : {
                OR: [{ userId: user.userId }, { userId: null }],
              },
        orderBy: { criadoEm: 'desc' },
        take: 10,
      }),
      this.prisma.noticia.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 6,
      }),
      this.prisma.user.count({
        where: { role: UserRole.CIDADAO, eliminadoEm: null },
      }),
    ]);

    const ecopontoMaisOcupado =
      ecopontos.length === 0
        ? null
        : ecopontos.reduce((a, b) => (a.ocupacao >= b.ocupacao ? a : b));
    const alerta =
      ecopontoMaisOcupado != null &&
      ecopontoMaisOcupado.ocupacao >= ECOPONTO_ALERT_THRESHOLD
        ? ecopontoMaisOcupado
        : null;

    let personalTotal = 0;
    let personalResolved = 0;

    if (isCitizen && user) {
      [personalTotal, personalResolved] = await Promise.all([
        this.prisma.report.count({ where: { userId: user.userId } }),
        this.prisma.report.count({
          where: { userId: user.userId, status: ReportStatus.RESOLVIDO },
        }),
      ]);
    }

    const ativos = Math.max(personalTotal - personalResolved, 0);
    const progresso =
      personalTotal > 0
        ? Math.round((personalResolved / personalTotal) * PERCENTAGE_FACTOR)
        : 0;

    const proximoNivel =
      personalTotal === 0
        ? 'Reciclador Avançado'
        : progresso >= 80
          ? 'Mestre Reciclador'
          : 'Reciclador Avançado';

    const pontos = Math.min(GAMIFICATION_MAX_POINTS, personalResolved * PTS_PER_RESOLVED_REPORT + ativos * PTS_PER_ACTIVE_REPORT);
    const pontosProximo = GAMIFICATION_MAX_POINTS;
    const nivel = pontos >= PTS_ADVANCED_LEVEL_THRESHOLD ? 'Reciclador Avançado' : 'Reciclador';

    const reciclagemKg = personalResolved * KG_RECYCLED_PER_REPORT;
    const arvoresEquivalentes = Math.max(0, Math.floor(personalResolved / REPORTS_PER_TREE));

    return {
      ecopontos: ecopontos.map((e) => ({
        id: e.id,
        nome: e.nome,
        distancia: e.distanciaLabel,
        ocupacao: (e as any).ocupacao,
        lat: e.lat,
        lng: e.lng,
        map_url: e.mapTileUrl ?? '',
      })),
      partilhas: partilhas.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        utilizador: p.autorNome,
        zona: p.zona,
      })),
      noticias: noticias.map((n) => ({
        id: n.id,
        imagem_url: n.imagemUrl,
        titulo: n.titulo,
        resumo: n.resumo,
        conteudo: n.conteudo,
        data: datePt.format(n.publishedAt),
        tempo_leitura: `${n.tempoLeituraMin} min`,
        tag: n.tag,
      })),
      alerta: alerta
        ? { nome: alerta.nome, ocupacao: alerta.ocupacao }
        : null,
      viewer:
        currentUser == null
          ? null
          : {
              id: currentUser.id,
              nome: currentUser.cidadaoPerfil?.nomeCompleto ?? null,
              email: currentUser.email,
              role: currentUser.role,
            },
      gamification: {
        nivel,
        pontos,
        pontos_proximo: pontosProximo,
      },
      impacto: {
        reciclagem_kg: reciclagemKg,
        comunidade_pax: comunidadePax,
        arvores_equivalentes: arvoresEquivalentes,
      },
      reports: {
        ativos,
        resolvidos: personalResolved,
        total: personalTotal,
        progresso,
        proximo_nivel: proximoNivel,
      },
    };
  }
}
