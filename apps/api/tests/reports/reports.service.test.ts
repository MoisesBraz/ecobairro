import assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportStatus } from '@prisma/client';
import { ReportsService } from '../../src/reports/reports.service';
import type { TestCase } from '../test-helpers';
import { CreateReportDto } from '../../src/reports/dto/create-report.dto';

interface FakeReportRecord {
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
  atualizadoEm: Date;
}

class FakePrismaService {
  private readonly reportsStore: FakeReportRecord[];
  private nextId = 1;

  readonly report = {
    create: async (args: {
      data: {
        titulo: string;
        tipo: string;
        descricao: string;
        local: string;
        imagemUrl?: string | null;
        userId: string;
        lat?: number | null;
        lng?: number | null;
      };
    }) => {
      const now = new Date('2026-04-25T10:00:00.000Z');
      const record: FakeReportRecord = {
        id: `00000000-0000-0000-0000-${String(this.nextId++).padStart(12, '0')}`,
        titulo: args.data.titulo,
        tipo: args.data.tipo,
        descricao: args.data.descricao,
        local: args.data.local,
        imagemUrl: args.data.imagemUrl ?? null,
        lat: args.data.lat ?? null,
        lng: args.data.lng ?? null,
        status: ReportStatus.PENDENTE,
        userId: args.data.userId,
        criadoEm: now,
        atualizadoEm: now,
      };
      this.reportsStore.unshift(record);
      return cloneReport(record);
    },
    findMany: async (args: {
      where: {
        userId?: string;
        status?: ReportStatus;
        tipo?: string;
        OR?: Array<{ titulo?: { contains: string }; local?: { contains: string }; descricao?: { contains: string } }>;
      };
      orderBy: { criadoEm: 'desc' };
      skip: number;
      take: number;
    }) => {
      const filtered = this.applyWhere(args.where);
      return filtered.slice(args.skip, args.skip + args.take).map(cloneReport);
    },
    count: async (args: {
      where: {
        userId?: string;
        status?: ReportStatus;
        tipo?: string;
        OR?: Array<{ titulo?: { contains: string }; local?: { contains: string }; descricao?: { contains: string } }>;
      };
    }) => this.applyWhere(args.where).length,
    updateMany: async (args: { where: { id: string }; data: { status: ReportStatus } }) => {
      const report = this.reportsStore.find((item) => item.id === args.where.id);
      if (!report) {
        return { count: 0 };
      }
      report.status = args.data.status;
      report.atualizadoEm = new Date('2026-04-25T11:00:00.000Z');
      return { count: 1 };
    },
    findUnique: async (args: { where: { id: string } }) => {
      const report = this.reportsStore.find((item) => item.id === args.where.id);
      return report ? cloneReport(report) : null;
    },
  };

  constructor(initialReports: FakeReportRecord[]) {
    this.reportsStore = initialReports.map(cloneReport);
  }

  $transaction<T>(input: Promise<T>[]): Promise<T[]>;
  $transaction<T>(input: (tx: FakePrismaService) => Promise<T>): Promise<T>;
  async $transaction<T>(
    input: Promise<T>[] | ((tx: FakePrismaService) => Promise<T>),
  ): Promise<T[] | T> {
    if (typeof input === 'function') {
      return input(this);
    }
    return Promise.all(input);
  }

  private applyWhere(where: {
    userId?: string;
    status?: ReportStatus;
    tipo?: string;
    OR?: Array<{ titulo?: { contains: string }; local?: { contains: string }; descricao?: { contains: string } }>;
  }): FakeReportRecord[] {
    return this.reportsStore.filter((item) => {
      if (where.userId && item.userId !== where.userId) {
        return false;
      }
      if (where.status && item.status !== where.status) {
        return false;
      }
      if (where.tipo && item.tipo !== where.tipo) {
        return false;
      }
      if (!where.OR || where.OR.length === 0) {
        return true;
      }

      const search = where.OR[0]?.titulo?.contains ?? where.OR[0]?.local?.contains ?? where.OR[0]?.descricao?.contains ?? '';
      if (!search) {
        return true;
      }

      const needle = search.toLowerCase();
      return (
        item.titulo.toLowerCase().includes(needle) ||
        item.local.toLowerCase().includes(needle) ||
        item.descricao.toLowerCase().includes(needle)
      );
    });
  }
}

export const reportsServiceTests: TestCase[] = [
  {
    name: 'validates minimum character limits for create report payload',
    run: async () => {
      const dto = plainToInstance(CreateReportDto, {
        titulo: 'ab',
        tipo: 'Ecoponto Cheio',
        descricao: 'curta',
        local: 'A',
      });

      const errors = await validate(dto);
      const fieldsWithErrors = errors.map((error: { property: string }) => error.property);

      assert.deepEqual(fieldsWithErrors.sort(), ['descricao', 'local', 'titulo']);
    },
  },
  {
    name: 'accepts create report payload exactly at minimum character limits',
    run: async () => {
      const dto = plainToInstance(CreateReportDto, {
        titulo: 'abc',
        tipo: 'Ecoponto Cheio',
        descricao: '1234567890',
        local: 'Ave',
      });

      const errors = await validate(dto);
      assert.equal(errors.length, 0);
    },
  },
  {
    name: 'creates a report for citizen users',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      const result = await service.createReport('user-1', 'CIDADAO', {
        titulo: 'Ecoponto cheio',
        tipo: 'Ecoponto Cheio',
        descricao: 'Contentor cheio há mais de 2 dias',
        local: 'Praça do Rossio',
      });

      assert.equal(result.report.status, 'pendente');
      assert.equal(result.report.user_id, 'user-1');
      assert.equal(result.report.tipo, 'Ecoponto Cheio');
    },
  },
  {
    name: 'allows gestor and admin to create reports too',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      for (const role of ['GESTOR', 'ADMIN'] as const) {
        const result = await service.createReport(`user-${role}`, role, {
          titulo: 'Teste',
          tipo: 'Odores',
          descricao: 'Descrição válida com tamanho mínimo',
          local: 'Aveiro',
        });
        assert.equal(result.report.status, 'pendente');
        assert.equal(result.report.user_id, `user-${role}`);
      }
    },
  },
  {
    name: 'blocks report creation for operator (staff de terreno)',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      await assert.rejects(
        () =>
          service.createReport('user-2', 'OPERADOR', {
            titulo: 'Teste',
            tipo: 'Odores',
            descricao: 'Descrição válida com tamanho mínimo',
            local: 'Aveiro',
          }),
        (error: Error) =>
          error instanceof ForbiddenException &&
          error.message === 'Não tem permissão para esta acção.',
      );
    },
  },
  {
    name: 'persists coordinates when both lat and lng are provided',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      const result = await service.createReport('user-1', 'CIDADAO', {
        titulo: 'Ecoponto cheio',
        tipo: 'Ecoponto Cheio',
        descricao: 'Contentor cheio há mais de 2 dias',
        local: 'Praça do Rossio',
        lat: 40.6405,
        lng: -8.6538,
      });

      assert.equal(result.report.lat, 40.6405);
      assert.equal(result.report.lng, -8.6538);
    },
  },
  {
    name: 'rejects georeferenced report outside Aveiro',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      await assert.rejects(
        () =>
          service.createReport('user-1', 'CIDADAO', {
            titulo: 'Fora de Aveiro',
            tipo: 'Odores',
            descricao: 'Descrição válida com tamanho mínimo',
            local: 'Lisboa',
            lat: 38.72,
            lng: -9.14,
          }),
        (e: unknown) => e instanceof BadRequestException,
      );
    },
  },
  {
    name: 'ignores coordinates when only one of lat/lng is provided',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      const result = await service.createReport('user-1', 'CIDADAO', {
        titulo: 'Ecoponto cheio',
        tipo: 'Ecoponto Cheio',
        descricao: 'Contentor cheio há mais de 2 dias',
        local: 'Praça do Rossio',
        lat: 40.6405,
      });

      assert.equal(result.report.lat, undefined);
      assert.equal(result.report.lng, undefined);
    },
  },
  {
    name: 'lists only own reports for citizens',
    run: async () => {
      const service = new ReportsService(
        new FakePrismaService([
          buildReport({
            id: '00000000-0000-0000-0000-000000000001',
            userId: 'user-1',
            titulo: 'Reporte 1',
          }),
          buildReport({
            id: '00000000-0000-0000-0000-000000000002',
            userId: 'user-2',
            titulo: 'Reporte 2',
          }),
        ]) as never,
      );

      const result = await service.listMyReports('user-1', 'CIDADAO', {
        page: 1,
        pageSize: 10,
      });

      assert.equal(result.total, 1);
      assert.equal(result.reports[0]?.user_id, 'user-1');
    },
  },
  {
    name: 'allows operational users to list reports with filters',
    run: async () => {
      const service = new ReportsService(
        new FakePrismaService([
          buildReport({
            id: '00000000-0000-0000-0000-000000000003',
            status: ReportStatus.ANALISE,
            titulo: 'Deposição ilegal no centro',
          }),
          buildReport({
            id: '00000000-0000-0000-0000-000000000004',
            status: ReportStatus.PENDENTE,
            titulo: 'Outro reporte',
          }),
        ]) as never,
      );

      const result = await service.listReports('GESTOR', {
        status: 'analise',
        q: 'ilegal',
      });

      assert.equal(result.total, 1);
      assert.equal(result.reports[0]?.status, 'analise');
    },
  },
  {
    name: 'allows operator/admin to update report status',
    run: async () => {
      const service = new ReportsService(
        new FakePrismaService([
          buildReport({
            id: '00000000-0000-0000-0000-000000000005',
            status: ReportStatus.PENDENTE,
          }),
        ]) as never,
      );

      const result = await service.updateReportStatus(
        'ADMIN',
        '00000000-0000-0000-0000-000000000005',
        { status: 'resolvido' },
      );

      assert.equal(result.report.status, 'resolvido');
    },
  },
  {
    name: 'blocks citizen from updating report status',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      await assert.rejects(
        () =>
          service.updateReportStatus(
            'CIDADAO',
            '00000000-0000-0000-0000-000000000006',
            { status: 'analise' },
          ),
        (error: Error) =>
          error instanceof ForbiddenException &&
          error.message === 'Não tem permissão para esta acção.',
      );
    },
  },
  {
    name: 'returns not found when updating a missing report',
    run: async () => {
      const service = new ReportsService(new FakePrismaService([]) as never);

      await assert.rejects(
        () =>
          service.updateReportStatus(
            'GESTOR',
            '00000000-0000-0000-0000-000000000007',
            { status: 'analise' },
          ),
        (error: Error) =>
          error instanceof NotFoundException &&
          error.message === 'Reporte não encontrado.',
      );
    },
  },
  {
    name: 'operational user can cycle report status through analise, rejeitado and resolvido',
    run: async () => {
      const id = '00000000-0000-0000-0000-000000000010';
      const service = new ReportsService(
        new FakePrismaService([
          buildReport({
            id,
            status: ReportStatus.PENDENTE,
          }),
        ]) as never,
      );

      const s1 = await service.updateReportStatus('GESTOR', id, {
        status: 'analise',
      });
      assert.equal(s1.report.status, 'analise');

      const s2 = await service.updateReportStatus('GESTOR', id, {
        status: 'rejeitado',
      });
      assert.equal(s2.report.status, 'rejeitado');

      const s3 = await service.updateReportStatus('ADMIN', id, {
        status: 'resolvido',
      });
      assert.equal(s3.report.status, 'resolvido');
    },
  },
  {
    name: 'owner cancels a pending report',
    run: async () => {
      const id = '00000000-0000-0000-0000-000000000011';
      const service = new ReportsService(
        new FakePrismaService([buildReport({ id, userId: 'user-1' })]) as never,
      );

      const result = await service.cancelOwnReport('user-1', 'CIDADAO', id);

      assert.equal(result.report.status, 'cancelado');
    },
  },
  {
    name: 'citizen cannot cancel another users report',
    run: async () => {
      const id = '00000000-0000-0000-0000-000000000012';
      const service = new ReportsService(
        new FakePrismaService([buildReport({ id, userId: 'user-2' })]) as never,
      );

      await assert.rejects(
        () => service.cancelOwnReport('user-1', 'CIDADAO', id),
        (error: Error) => error instanceof NotFoundException,
      );
    },
  },
  {
    name: 'citizen cannot cancel a report after triage',
    run: async () => {
      const id = '00000000-0000-0000-0000-000000000013';
      const service = new ReportsService(
        new FakePrismaService([
          buildReport({ id, userId: 'user-1', status: ReportStatus.ANALISE }),
        ]) as never,
      );

      await assert.rejects(
        () => service.cancelOwnReport('user-1', 'CIDADAO', id),
        (error: Error) => error instanceof ConflictException,
      );
    },
  },
];

function buildReport(
  overrides: Partial<FakeReportRecord> = {},
): FakeReportRecord {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000999',
    titulo: overrides.titulo ?? 'Reporte teste',
    tipo: overrides.tipo ?? 'Ecoponto Cheio',
    descricao: overrides.descricao ?? 'Descrição de teste com detalhe suficiente',
    local: overrides.local ?? 'Aveiro',
    imagemUrl: overrides.imagemUrl ?? null,
    status: overrides.status ?? ReportStatus.PENDENTE,
    userId: overrides.userId ?? 'user-1',
    criadoEm: overrides.criadoEm ?? new Date('2026-04-25T09:00:00.000Z'),
    atualizadoEm: overrides.atualizadoEm ?? new Date('2026-04-25T09:00:00.000Z'),
  };
}

function cloneReport(report: FakeReportRecord): FakeReportRecord {
  return {
    ...report,
    criadoEm: new Date(report.criadoEm),
    atualizadoEm: new Date(report.atualizadoEm),
  };
}
