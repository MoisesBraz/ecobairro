import { Inject, Injectable } from '@nestjs/common';
import type {
  AnalyticsResponse,
  AnalyticsMonthly,
  AnalyticsTipo,
  AnalyticsZona,
  UserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { forbidden } from '../common/errors';

const ALLOWED: UserRole[] = ['GESTOR', 'ADMIN'];

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ANALYTICS_MONTHS_WINDOW = 7; // Últimos 7 meses no gráfico mensal
const PERCENTAGE_FACTOR = 100;

@Injectable()
export class AnalyticsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getAnalytics(callerRole: UserRole): Promise<AnalyticsResponse> {
    if (!ALLOWED.includes(callerRole)) {
      throw forbidden('FORBIDDEN');
    }

    const now   = new Date();
    const year  = now.getUTCFullYear();
    const month = now.getUTCMonth(); // 0-based

    // Build last 7 months labels + date ranges
    const months = Array.from({ length: ANALYTICS_MONTHS_WINDOW }, (_, i) => {
      const m = ((month - (ANALYTICS_MONTHS_WINDOW - 1) + i) + 12) % 12;
      const y = month - (ANALYTICS_MONTHS_WINDOW - 1) + i < 0 ? year - 1 : year;
      return { label: PT_MONTHS[m]!, year: y, month: m };
    });

    // Reports per month (all)
    const reportRows = await this.prisma.$queryRaw<{ yr: number; mo: number; cnt: bigint }[]>`
      SELECT EXTRACT(YEAR  FROM "criado_em")::int  AS yr,
             EXTRACT(MONTH FROM "criado_em")::int - 1 AS mo,
             COUNT(*)::bigint                          AS cnt
      FROM   reports
      GROUP  BY yr, mo
    `;

    // Resolved reports per month
    const resolvedRows = await this.prisma.$queryRaw<{ yr: number; mo: number; cnt: bigint }[]>`
      SELECT EXTRACT(YEAR  FROM "criado_em")::int  AS yr,
             EXTRACT(MONTH FROM "criado_em")::int - 1 AS mo,
             COUNT(*)::bigint                          AS cnt
      FROM   reports
      WHERE  status = 'RESOLVIDO'
      GROUP  BY yr, mo
    `;

    function findCnt(rows: { yr: number; mo: number; cnt: bigint }[], y: number, m: number): number {
      const r = rows.find(r => r.yr === y && r.mo === m);
      return r ? Number(r.cnt) : 0;
    }

    const reports_mensais: AnalyticsMonthly[] = months.map(({ label, year: y, month: m }) => ({
      label,
      value: findCnt(reportRows, y, m),
    }));

    const resolucao_mensais: AnalyticsMonthly[] = months.map(({ label, year: y, month: m }) => ({
      label,
      value: findCnt(resolvedRows, y, m),
    }));

    // Reports by tipo
    const tipoRows = await this.prisma.$queryRaw<{ tipo: string; cnt: bigint }[]>`
      SELECT tipo, COUNT(*)::bigint AS cnt FROM reports GROUP BY tipo ORDER BY cnt DESC
    `;
    const totalTipos = tipoRows.reduce((s, r) => s + Number(r.cnt), 0) || 1;
    const tipos: AnalyticsTipo[] = tipoRows.map(r => ({
      tipo:  r.tipo,
      total: Number(r.cnt),
      pct:   Math.round((Number(r.cnt) / totalTipos) * PERCENTAGE_FACTOR),
    }));

    // Ecopontos + reports grouped by zone
    const ecopontoZonaRows = await this.prisma.$queryRaw<{ zona: string; cnt: bigint }[]>`
      SELECT COALESCE(zona, 'Sem zona') AS zona, COUNT(*)::bigint AS cnt
      FROM   ecopontos
      WHERE  ativo = true
      GROUP  BY zona
      ORDER  BY cnt DESC
    `;

    // Reports by zone (match on local text containing zone name)
    const zonaNames = [...new Set(ecopontoZonaRows.map(r => r.zona))];
    const zonaReportMap: Record<string, { total: number; resolved: number }> = {};
    for (const zona of zonaNames) {
      if (zona === 'Sem zona') continue;
      const [tRows, rRows] = await Promise.all([
        this.prisma.report.count({ where: { local: { contains: zona, mode: 'insensitive' } } }),
        this.prisma.report.count({ where: { local: { contains: zona, mode: 'insensitive' }, status: 'RESOLVIDO' } }),
      ]);
      zonaReportMap[zona] = { total: tRows, resolved: rRows };
    }

    const zonas: AnalyticsZona[] = ecopontoZonaRows.map(r => ({
      zona:       r.zona,
      ecopontos:  Number(r.cnt),
      reportes:   zonaReportMap[r.zona]?.total   ?? 0,
      resolvidos: zonaReportMap[r.zona]?.resolved ?? 0,
    }));

    // KPIs
    const [totalReports, mesReports, ecoAtivos, totalUsers] = await Promise.all([
      this.prisma.report.count(),
      this.prisma.report.count({
        where: {
          criadoEm: {
            gte: new Date(Date.UTC(year, month, 1)),
          },
        },
      }),
      this.prisma.ecoponto.count({ where: { ativo: true } }),
      this.prisma.user.count({ where: { eliminadoEm: null } }),
    ]);

    const totalResolved = await this.prisma.report.count({ where: { status: 'RESOLVIDO' } });
    const taxaResolucao = totalReports > 0 ? Math.round((totalResolved / totalReports) * PERCENTAGE_FACTOR) : 0;

    return {
      kpis: {
        reports_total:    totalReports,
        reports_mes:      mesReports,
        taxa_resolucao:   taxaResolucao,
        ecopontos_ativos: ecoAtivos,
        users_total:      totalUsers,
      },
      reports_mensais,
      resolucao_mensais,
      tipos,
      zonas,
    };
  }
}
