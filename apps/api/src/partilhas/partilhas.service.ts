import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreatePartilhaRequest,
  CreatePartilhaResponse,
  ExpressPartilhaInterestRequest,
  ExpressPartilhaInterestResponse,
  ListPartilhasQuery,
  ListPartilhasResponse,
  PartilhaRecord,
  UserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { badRequest, forbidden, notFound, serviceUnavailable } from '../common/errors';

@Injectable()
export class PartilhasService {
  private readonly prisma: PrismaService;
  private readonly mail: MailService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(MailService) mail: MailService,
  ) {
    this.prisma = prisma;
    this.mail = mail;
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

  /**
   * Manifesta interesse numa partilha. Não expõe contactos na UI: notifica o
   * autor por email com o nome e email de quem demonstrou interesse (e uma
   * mensagem opcional), para o autor combinar a entrega. O interessado consente
   * partilhar o seu próprio contacto ao carregar no botão.
   */
  async expressInterest(
    interessadoId: string,
    partilhaId: string,
    input: ExpressPartilhaInterestRequest,
  ): Promise<ExpressPartilhaInterestResponse> {
    const partilha = await this.prisma.partilha.findUnique({
      where: { id: partilhaId },
      select: { id: true, titulo: true, zona: true, userId: true },
    });
    if (!partilha) throw notFound('NOT_FOUND');

    // Não faz sentido manifestar interesse na própria partilha.
    if (partilha.userId && partilha.userId === interessadoId) {
      throw badRequest('VALIDATION_ERROR', 'Não pode manifestar interesse na sua própria partilha.');
    }

    // Autor anonimizado/removido (userId nulo) — não há a quem notificar.
    if (!partilha.userId) {
      throw serviceUnavailable(
        'SERVICE_UNAVAILABLE',
        'Não é possível contactar o autor desta partilha.',
      );
    }

    const [autor, interessado, interessadoPerfil] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: partilha.userId }, select: { email: true } }),
      this.prisma.user.findUnique({ where: { id: interessadoId }, select: { email: true } }),
      this.prisma.cidadaoPerfil.findUnique({
        where: { userId: interessadoId },
        select: { nomeCompleto: true },
      }),
    ]);

    if (!autor?.email) {
      throw serviceUnavailable(
        'SERVICE_UNAVAILABLE',
        'Não é possível contactar o autor desta partilha.',
      );
    }

    const interessadoNome = interessadoPerfil?.nomeCompleto ?? interessado?.email ?? 'Um cidadão';
    if (!interessado?.email) {
      throw serviceUnavailable(
        'SERVICE_UNAVAILABLE',
        'Não foi possível obter os dados de contacto.',
      );
    }
    const interessadoEmail = interessado.email;

    await this.mail.send('partilha-interesse', {
      to: autor.email,
      subject: `Alguém tem interesse na sua partilha "${partilha.titulo}"`,
      variables: {
        tituloPartilha: partilha.titulo,
        zona: partilha.zona,
        interessadoNome,
        interessadoEmail,
        mensagem: input.mensagem?.trim() || '(sem mensagem)',
      },
    });

    return { notificado: true };
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
