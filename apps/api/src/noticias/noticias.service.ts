import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ListNoticiasQuery,
  ListNoticiasResponse,
  NoticiaRecord,
  CreateNoticiaRequest,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NoticiasService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(query: ListNoticiasQuery): Promise<ListNoticiasResponse> {
    const page     = coerce(query.page,     1);
    const pageSize = coerce(query.pageSize, 10);
    const skip     = (page - 1) * pageSize;

    const where: Prisma.NoticiaWhereInput = query.q
      ? {
          OR: [
            { titulo:  { contains: query.q, mode: 'insensitive' } },
            { resumo:  { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.noticia.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.noticia.count({ where }),
    ]);

    return { noticias: rows.map(mapRow), page, pageSize, total };
  }

  async getById(id: string): Promise<NoticiaRecord | null> {
    const row = await this.prisma.noticia.findUnique({
      where: { id },
    });
    return row ? mapRow(row) : null;
  }

  async create(data: CreateNoticiaRequest): Promise<NoticiaRecord> {
    const row = await this.prisma.noticia.create({
      data: {
        titulo: data.titulo,
        resumo: data.resumo,
        conteudo: data.conteudo ?? '',
        imagemUrl: data.imagem_url ?? '/news_placeholder.png',
        tag: data.categoria ?? 'Geral',
        destaque: data.destaque ?? false,
        tempoLeituraMin: data.tempo_leitura_min ?? 5,
        publishedAt: new Date(),
      },
    });
    return mapRow(row);
  }
}

function mapRow(n: {
  id: string;
  titulo: string;
  resumo: string;
  imagemUrl: string;
  conteudo: string;
  tag: string;
  destaque: boolean;
  publishedAt: Date;
  tempoLeituraMin: number;
}): NoticiaRecord {
  return {
    id:               n.id,
    titulo:           n.titulo,
    resumo:           n.resumo,
    imagem_url:       n.imagemUrl,
    conteudo:         n.conteudo,
    tag:              n.tag,
    destaque:         n.destaque,
    data:             n.publishedAt.toISOString(),
    tempo_leitura_min: n.tempoLeituraMin,
  };
}

function coerce(v: number | string | undefined, fallback: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return fallback;
}
