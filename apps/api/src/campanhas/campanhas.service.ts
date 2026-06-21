import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { CampanhaRecord, UserRole as ContractUserRole } from '@ecobairro/contracts';
import type { CreateCampanhaDto } from './dto/create-campanha.dto';
import type { UpdateCampanhaDto } from './dto/update-campanha.dto';
import type { ListCampanhasDto } from './dto/list-campanhas.dto';
import { forbidden } from '../common/errors';

// Campanhas/benefícios são geridos pela gestão e administração.
function assertManager(role: ContractUserRole): void {
  if (role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
    throw forbidden('FORBIDDEN');
  }
}

function mapRow(c: {
  id: string;
  titulo: string;
  corpo: string;
  estado: string;
  dataValidade: Date;
  autor: string;
  criadoEm: Date;
}): CampanhaRecord {
  return {
    id: c.id,
    titulo: c.titulo,
    corpo: c.corpo,
    estado: c.estado as CampanhaRecord['estado'],
    data_criacao: c.criadoEm.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    data_validade: c.dataValidade.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    autor: c.autor,
  };
}

function coerce(v: number | string | undefined, def: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return def;
}

@Injectable()
export class CampanhasService {
  private readonly prisma: PrismaService;
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(role: ContractUserRole, query: ListCampanhasDto) {
    assertManager(role);
    const page = coerce(query.page, 1);
    const pageSize = coerce(query.pageSize, 20);
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.q
        ? { titulo: { contains: query.q, mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.campanha.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.campanha.count({ where }),
    ]);

    return { campanhas: rows.map(mapRow), total, page, pageSize };
  }

  /**
   * Campanhas/benefícios visíveis ao público (cidadão): as que o gestor marcou
   * como publicadas. A visibilidade é controlada pelo estado (publicada vs
   * expirada); a data de validade é apenas informativa. Não expõe rascunhos.
   */
  async listPublicadas(): Promise<{ campanhas: CampanhaRecord[] }> {
    const rows = await this.prisma.campanha.findMany({
      where: { estado: 'publicada' },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    return { campanhas: rows.map(mapRow) };
  }

  async create(role: ContractUserRole, dto: CreateCampanhaDto, userId: string): Promise<CampanhaRecord> {
    assertManager(role);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, cidadaoPerfil: { select: { nomeCompleto: true } } },
    });
    const autor =
      user?.cidadaoPerfil?.nomeCompleto ??
      user?.email?.split('@')[0] ??
      'Câmara de Aveiro';

    const row = await this.prisma.campanha.create({
      data: {
        titulo: dto.titulo,
        corpo: dto.corpo,
        dataValidade: new Date(dto.dataValidade),
        autor,
      },
    });
    return mapRow(row);
  }

  async update(role: ContractUserRole, id: string, dto: UpdateCampanhaDto): Promise<CampanhaRecord> {
    assertManager(role);
    const row = await this.prisma.campanha.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.corpo !== undefined && { corpo: dto.corpo }),
        ...(dto.estado !== undefined && { estado: dto.estado }),
        ...(dto.dataValidade !== undefined && {
          dataValidade: new Date(dto.dataValidade),
        }),
      },
    });
    return mapRow(row);
  }
}
