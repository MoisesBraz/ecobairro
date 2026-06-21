import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreatePartilhaRequest,
  CreatePartilhaResponse,
  ListPartilhasQuery,
  ListPartilhasResponse,
  PartilhaRecord,
  UserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { forbidden } from '../common/errors';

@Injectable()
export class PartilhasService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(query: ListPartilhasQuery): Promise<ListPartilhasResponse> {
    const page     = coercePositiveInt(query.page,     1);
    const pageSize = coercePositiveInt(query.pageSize, 12);
    const skip     = (page - 1) * pageSize;

    const where: Prisma.PartilhaWhereInput = {
      ...(query.categoria ? { categoria: query.categoria } : {}),
      ...(query.q
        ? {
            OR: [
              { titulo: { contains: query.q, mode: 'insensitive' } },
              { zona:   { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.partilha.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.partilha.count({ where }),
    ]);

    return { partilhas: rows.map(mapRow), page, pageSize, total };
  }

  async create(
    userId: string,
    role: UserRole,
    input: CreatePartilhaRequest,
  ): Promise<CreatePartilhaResponse> {
    if (role !== 'CIDADAO') {
      throw forbidden('FORBIDDEN');
    }

    /* Resolve display name from profile */
    const profile = await this.prisma.cidadaoPerfil.findUnique({
      where: { userId },
      select: { nomeCompleto: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const autorNome = profile?.nomeCompleto ?? user?.email ?? 'Cidadão';

    const row = await this.prisma.partilha.create({
      data: {
        titulo:    input.titulo,
        zona:      input.zona,
        categoria: input.categoria,
        imagemUrl: input.imagem_url ?? null,
        autorNome,
        userId,
      },
    });

    return { partilha: mapRow(row) };
  }
}

function mapRow(p: {
  id: string;
  titulo: string;
  autorNome: string;
  zona: string;
  categoria: string;
  imagemUrl: string | null;
  userId: string | null;
  criadoEm: Date;
}): PartilhaRecord {
  return {
    id:         p.id,
    titulo:     p.titulo,
    autorNome:  p.autorNome,
    zona:       p.zona,
    categoria:  p.categoria as PartilhaRecord['categoria'],
    imagem_url: p.imagemUrl,
    data:       p.criadoEm.toISOString(),
    user_id:    p.userId,
  };
}

function coercePositiveInt(v: number | string | undefined, fallback: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return fallback;
}
