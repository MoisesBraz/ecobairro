import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuditLogRecord, UserRole as ContractUserRole } from '@ecobairro/contracts';
import type { ListAuditDto } from './dto/list-audit.dto';
import type { Prisma } from '@prisma/client';
import { forbidden } from '../common/errors';

// Os logs de auditoria são restritos à gestão/administração.
function assertManager(role: ContractUserRole): void {
  if (role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
    throw forbidden('FORBIDDEN');
  }
}

function mapRow(l: {
  id: string;
  utilizador: string;
  papel: string;
  acao: string;
  descricao: string;
  ip: string;
  criadoEm: Date;
}): AuditLogRecord {
  return {
    id: l.id,
    utilizador: l.utilizador,
    papel: l.papel,
    acao: l.acao as AuditLogRecord['acao'],
    descricao: l.descricao,
    ip: l.ip,
    data: l.criadoEm.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    hora: l.criadoEm.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    }),
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
export class AuditService {
  private readonly prisma: PrismaService;
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(role: ContractUserRole, query: ListAuditDto) {
    assertManager(role);
    const page = coerce(query.page, 1);
    const pageSize = coerce(query.pageSize, 50);
    const skip = (page - 1) * pageSize;

    const acaoWhere: Prisma.AuditLogWhereInput =
      query.acao === 'login_logout'
        ? { acao: { in: ['login', 'logout'] } }
        : query.acao
          ? { acao: query.acao }
          : {};

    const searchWhere: Prisma.AuditLogWhereInput = query.q
      ? {
          OR: [
            { utilizador: { contains: query.q, mode: 'insensitive' } },
            { descricao: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const where: Prisma.AuditLogWhereInput = {
      ...acaoWhere,
      ...searchWhere,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs: rows.map(mapRow), total, page, pageSize };
  }

  async write(data: {
    utilizador: string;
    papel: string;
    acao: string;
    descricao: string;
    ip?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        utilizador: data.utilizador,
        papel: data.papel,
        acao: data.acao,
        descricao: data.descricao,
        ip: data.ip ?? '0.0.0.0',
      },
    });
  }
}
