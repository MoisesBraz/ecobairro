import { Inject, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type {
  ListUsersQuery,
  ListUsersResponse,
  UserRecord,
  UserRole as ContractRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { DB_ROLE_LABEL, roleFromString } from './roles.util';
import { forbidden } from '../common/errors';

@Injectable()
export class UsersService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(
    callerRole: ContractRole,
    query: ListUsersQuery,
  ): Promise<ListUsersResponse> {
    if (callerRole !== 'ADMIN') {
      throw forbidden('FORBIDDEN');
    }

    const page     = coerce(query.page,     1);
    const pageSize = coerce(query.pageSize, 20);
    const skip     = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      ...(query.role
        ? { role: roleFromString(query.role) }
        : {}),
      // O filtro 'ativo' controla o eliminadoEm; por defeito mostra só ativos.
      // (Antes a base forçava eliminadoEm:null, anulando o filtro 'inativo'.)
      ...(query.ativo === undefined
        ? { eliminadoEm: null }
        : query.ativo
          ? { eliminadoEm: null }
          : { NOT: { eliminadoEm: null } }),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { cidadaoPerfil: { nomeCompleto: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total, ativos, inativos, admins] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        include: { cidadaoPerfil: { select: { nomeCompleto: true } } },
      }),
      this.prisma.user.count({ where }),
      // Contagens globais (independentes de filtros/paginação) para os cartões.
      this.prisma.user.count({ where: { eliminadoEm: null } }),
      this.prisma.user.count({ where: { NOT: { eliminadoEm: null } } }),
      this.prisma.user.count({ where: { eliminadoEm: null, role: UserRole.ADMIN } }),
    ]);

    return {
      users: rows.map(r => mapRow(r)),
      total,
      page,
      pageSize,
      counts: { ativos, inativos, admins },
    };
  }
}

function mapRow(u: {
  id: string;
  email: string;
  role: UserRole;
  criadoEm: Date;
  eliminadoEm: Date | null;
  cidadaoPerfil: { nomeCompleto: string | null } | null;
}): UserRecord {
  return {
    id:         u.id,
    email:      u.email,
    role:       DB_ROLE_LABEL[u.role],
    nome:       u.cidadaoPerfil?.nomeCompleto ?? null,
    ativo:      u.eliminadoEm === null,
    criado_em:  u.criadoEm.toISOString(),
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
