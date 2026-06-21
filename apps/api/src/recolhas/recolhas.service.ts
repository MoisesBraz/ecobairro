import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { RecolhaRecord, UserRole } from '@ecobairro/contracts';
import type { CreateRecolhaDto } from './dto/create-recolha.dto';
import type { ListRecolhasDto } from './dto/list-recolhas.dto';

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
}
