import { Inject, Injectable } from '@nestjs/common';
import { Prisma, ReportStatus, UserRole } from '@prisma/client';
import type {
  CreateReportRequest,
  CreateReportResponse,
  ListReportsQuery,
  ListReportsResponse,
  ReportRecord,
  ReportStatsResponse,
  ReportStatus as ContractReportStatus,
  UserRole as ContractUserRole,
  UpdateReportStatusRequest,
  UpdateReportStatusResponse,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { isWithinAveiro } from '../common/geo';
import { badRequest, forbidden, notFound } from '../common/errors';

const REPORT_STATUS_MAP: Record<ContractReportStatus, ReportStatus> = {
  pendente: ReportStatus.PENDENTE,
  analise: ReportStatus.ANALISE,
  resolvido: ReportStatus.RESOLVIDO,
  rejeitado: ReportStatus.REJEITADO,
};

const DB_STATUS_MAP: Record<ReportStatus, ContractReportStatus> = {
  PENDENTE: 'pendente',
  ANALISE: 'analise',
  RESOLVIDO: 'resolvido',
  REJEITADO: 'rejeitado',
};

@Injectable()
export class ReportsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async createReport(
    userId: string,
    role: ContractUserRole,
    input: CreateReportRequest,
  ): Promise<CreateReportResponse> {
    assertCanSelfReport(role);

    // Coordenadas só são persistidas se vierem as duas (geom precisa de par lat+lng).
    const hasCoords =
      typeof input.lat === 'number' && typeof input.lng === 'number';

    // Quando georreferenciado, o ponto tem de cair no concelho de Aveiro.
    // (Sem coords o report é não-georreferenciado — permitido por design, ver
    // `apps/api/src/reports/CLAUDE.md`.)
    if (hasCoords && !isWithinAveiro(input.lat as number, input.lng as number)) {
      throw badRequest(
        'VALIDATION_ERROR',
        'Localização fora do concelho de Aveiro.',
      );
    }

    const report = await this.prisma.report.create({
      data: {
        titulo: input.titulo,
        tipo: input.tipo,
        descricao: input.descricao,
        local: input.local,
        imagemUrl: input.imagem ?? null,
        userId,
        ...(hasCoords ? { lat: input.lat, lng: input.lng } : {}),
      },
    });

    return {
      report: mapReport(report),
    };
  }

  async listMyReports(
    userId: string,
    role: ContractUserRole,
    query: ListReportsQuery,
  ): Promise<ListReportsResponse> {
    assertCanSelfReport(role);
    return this.listReportsInternal({ userId }, query);
  }

  async listReports(
    role: ContractUserRole,
    query: ListReportsQuery,
  ): Promise<ListReportsResponse> {
    assertOperationalReader(role);
    return this.listReportsInternal({}, query);
  }

  async updateReportStatus(
    role: ContractUserRole,
    reportId: string,
    input: UpdateReportStatusRequest,
  ): Promise<UpdateReportStatusResponse> {
    assertOperationalWriter(role);

    const report = await this.prisma.report.updateMany({
      where: { id: reportId },
      data: {
        status: REPORT_STATUS_MAP[input.status],
      },
    });

    if (report.count === 0) {
      throw notFound('REPORT_NOT_FOUND');
    }

    const updated = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!updated) {
      throw notFound('REPORT_NOT_FOUND');
    }

    return {
      report: mapReport(updated),
    };
  }

  async getStats(
    userId: string,
    role: ContractUserRole,
    scope: 'me' | 'global' | undefined,
    recentLimit: number | undefined,
  ): Promise<ReportStatsResponse> {
    const resolvedScope: 'me' | 'global' = scope ?? defaultScopeForRole(role);

    if (resolvedScope === 'me') {
      assertCanReadOwn(role);
    } else {
      assertOperationalReader(role);
    }

    const where: Prisma.ReportWhereInput =
      resolvedScope === 'me' ? { userId } : {};

    const limit = clampRecentLimit(recentLimit);

    const [total, statusGroups, recent, zonaGroups] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.report.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        take: limit,
      }),
      this.prisma.report.groupBy({
        by: ['local'],
        where,
        _count: { _all: true },
        orderBy: { _count: { local: 'desc' } },
        take: 8,
      }),
    ]);

    const byStatus = { pendente: 0, analise: 0, resolvido: 0, rejeitado: 0 };
    for (const group of statusGroups) {
      const key = DB_STATUS_MAP[group.status];
      byStatus[key] = group._count._all;
    }

    return {
      total,
      byStatus,
      zonas: zonaGroups.map((row) => ({
        zona: row.local,
        total: row._count._all,
      })),
      recent: recent.map(mapReport),
      scope: resolvedScope,
    };
  }

  private async listReportsInternal(
    scope: { userId?: string },
    query: ListReportsQuery,
  ): Promise<ListReportsResponse> {
    const page = coercePositiveInt(query.page, 1);
    const pageSize = coercePositiveInt(query.pageSize, 10);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReportWhereInput = {
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(query.status ? { status: REPORT_STATUS_MAP[query.status] } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.q
        ? {
            OR: [
              { titulo: { contains: query.q, mode: 'insensitive' } },
              { local: { contains: query.q, mode: 'insensitive' } },
              { descricao: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports: rows.map(mapReport),
      page,
      pageSize,
      total,
    };
  }
}

function mapReport(report: {
  id: string;
  titulo: string;
  tipo: string;
  descricao: string;
  local: string;
  imagemUrl: string | null;
  status: ReportStatus;
  userId: string;
  lat?: number | null;
  lng?: number | null;
  criadoEm: Date;
}): ReportRecord {
  return {
    id: report.id,
    titulo: report.titulo,
    tipo: report.tipo as ReportRecord['tipo'],
    descricao: report.descricao,
    local: report.local,
    data: report.criadoEm.toISOString(),
    status: DB_STATUS_MAP[report.status],
    imagem: report.imagemUrl ?? undefined,
    user_id: report.userId,
    lat: report.lat ?? undefined,
    lng: report.lng ?? undefined,
  };
}

/**
 * Quem pode submeter e consultar os seus próprios reportes: o cidadão e também
 * o gestor/admin (que gerem a plataforma mas podem reportar ocorrências). O
 * operador é staff de terreno e fica de fora da criação.
 */
function assertCanSelfReport(role: ContractUserRole): void {
  if (
    role !== UserRole.CIDADAO &&
    role !== UserRole.GESTOR &&
    role !== UserRole.ADMIN
  ) {
    throw forbidden('FORBIDDEN');
  }
}

function assertCanReadOwn(role: ContractUserRole): void {
  if (
    role !== UserRole.CIDADAO &&
    role !== UserRole.OPERADOR &&
    role !== UserRole.GESTOR &&
    role !== UserRole.ADMIN
  ) {
    throw forbidden('FORBIDDEN');
  }
}

function defaultScopeForRole(role: ContractUserRole): 'me' | 'global' {
  return role === UserRole.CIDADAO ? 'me' : 'global';
}

function clampRecentLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return 10;
  }
  return Math.min(50, value);
}

function assertOperationalReader(role: ContractUserRole): void {
  if (
    role !== UserRole.OPERADOR &&
    role !== UserRole.GESTOR &&
    role !== UserRole.ADMIN
  ) {
    throw forbidden('FORBIDDEN');
  }
}

function assertOperationalWriter(role: ContractUserRole): void {
  if (role !== UserRole.OPERADOR && role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
    throw forbidden('FORBIDDEN');
  }
}

function coercePositiveInt(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}
