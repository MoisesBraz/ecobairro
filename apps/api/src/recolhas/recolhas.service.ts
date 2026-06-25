import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { RecolhaRecord, RecolhaStatus, UserRole } from '@ecobairro/contracts';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import type { CreateRecolhaDto } from './dto/create-recolha.dto';
import type { ListRecolhasDto } from './dto/list-recolhas.dto';
import type { UpdateRecolhaStatusDto } from './dto/update-recolha-status.dto';

function mapRow(r: {
  id: string;
  tipo: string;
  subtipo: string;
  morada: string;
  status: string;
  obs: string | null;
  criadoEm: Date;
  dataPrevista: string | null;
  userId: string | null;
}): RecolhaRecord {
  return {
    id: r.id,
    tipo: r.tipo,
    subtipo: r.subtipo,
    morada: r.morada,
    status: r.status as RecolhaRecord['status'],
    obs: r.obs,
    data_pedido: r.criadoEm.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    data_prevista: r.dataPrevista,
    user_id: r.userId,
  };
}

function coerce(v: number | string | undefined, def: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
    return v;
  }
  if (typeof v === 'string') {
    const parsed = Number.parseInt(v, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return def;
}

@Injectable()
export class RecolhasService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(userId: string, role: UserRole, query: ListRecolhasDto) {
    const page = coerce(query.page, 1);
    const pageSize = coerce(query.pageSize, 10);
    const skip = (page - 1) * pageSize;

    const where = {
      ...(role === 'CIDADAO' ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.recolha.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.recolha.count({ where }),
    ]);

    return {
      recolhas: rows.map(mapRow),
      total,
      page,
      pageSize,
    };
  }

  async create(userId: string, dto: CreateRecolhaDto): Promise<RecolhaRecord> {
    const row = await this.prisma.recolha.create({
      data: {
        tipo: dto.tipo,
        subtipo: dto.subtipo,
        morada: dto.morada,
        obs: dto.obs ?? null,
        userId,
      },
    });
    return mapRow(row);
  }

  async cancel(userId: string, role: UserRole, id: string): Promise<RecolhaRecord> {
    if (role !== 'CIDADAO') throw forbidden('FORBIDDEN');

    const current = await this.prisma.recolha.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });
    if (!current || current.userId !== userId) throw notFound('NOT_FOUND');
    if (current.status !== 'pendente') {
      throw conflict('CONFLICT', 'Só pode cancelar pedidos pendentes.');
    }

    const result = await this.prisma.recolha.updateMany({
      where: { id, userId, status: 'pendente' },
      data: { status: 'cancelado' },
    });
    if (result.count === 0) {
      throw conflict('CONFLICT', 'O pedido já não está pendente.');
    }

    const updated = await this.prisma.recolha.findUnique({ where: { id } });
    if (!updated) throw notFound('NOT_FOUND');
    return mapRow(updated);
  }

  /**
   * Atualiza o estado de uma recolha (triagem/agendamento). Só staff
   * (operador/gestor/admin) — o cidadão apenas cria e consulta as suas.
   * Transições válidas: pendente→agendado, pendente→concluido, agendado→concluido.
   */
  async updateStatus(
    role: UserRole,
    id: string,
    dto: UpdateRecolhaStatusDto,
  ): Promise<RecolhaRecord> {
    assertStaff(role);
    const current = await this.prisma.recolha.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw notFound('NOT_FOUND');
    validateTransition(current.status as RecolhaStatus, dto.status);
    try {
      const row = await this.prisma.recolha.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.data_prevista !== undefined
            ? { dataPrevista: dto.data_prevista }
            : {}),
        },
      });
      return mapRow(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw notFound('NOT_FOUND');
      }
      throw e;
    }
  }
}

function assertStaff(role: UserRole): void {
  if (role !== 'OPERADOR' && role !== 'GESTOR' && role !== 'ADMIN') {
    throw forbidden('FORBIDDEN');
  }
}

const VALID_TRANSITIONS: Partial<Record<RecolhaStatus, RecolhaStatus[]>> = {
  pendente: ['agendado', 'concluido'],
  agendado: ['concluido'],
};

function validateTransition(from: RecolhaStatus, to: RecolhaStatus): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!(allowed as string[]).includes(to)) {
    throw badRequest(
      'VALIDATION_ERROR',
      `Transição de '${from}' para '${to}' não é permitida.`,
    );
  }
}
