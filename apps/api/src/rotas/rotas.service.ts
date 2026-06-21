import { Inject, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type {
  RotaParagem,
  RotaRecord,
  UserRole as ContractUserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { forbidden, notFound } from '../common/errors';
import type { UpdateRotaDto } from './dto/update-rota.dto';
import type { CreateRotaDto } from './dto/create-rota.dto';

function mapRow(r: {
  id: string;
  nome: string;
  operador: string;
  operadorId: string | null;
  equipaId: string | null;
  estado: string;
  ecopontos: number;
  distancia: string;
  duracao: string;
  waypoints: unknown;
  geometria: unknown;
  paragens: unknown;
  zona: string | null;
  cor: string;
}): RotaRecord {
  return {
    id: r.id,
    nome: r.nome,
    operador: r.operador,
    operadorId: r.operadorId,
    equipaId: r.equipaId,
    estado: r.estado as RotaRecord['estado'],
    ecopontos: r.ecopontos,
    distancia: r.distancia,
    duracao: r.duracao,
    waypoints: (r.waypoints ?? []) as [number, number][],
    geometria: (r.geometria ?? []) as [number, number][],
    paragens: (r.paragens ?? []) as RotaParagem[],
    zona: r.zona,
    cor: r.cor,
  };
}

@Injectable()
export class RotasService {
  private readonly prisma: PrismaService;
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Lista de rotas. O operador só vê as rotas atribuídas a si (diretamente ou
   * via equipa de que é membro). Gestor/Admin veem todas.
   */
  async list(user: { userId: string; role: ContractUserRole }) {
    const where = await this.scopeForUser(user);
    const rows = await this.prisma.rota.findMany({
      where,
      orderBy: { criadoEm: 'asc' },
    });
    return { rotas: rows.map(mapRow), total: rows.length };
  }

  /**
   * Cria/guarda uma rota gerada (gestor/admin). O cálculo (ordem/geometria) é feito
   * no serviço analytics (OP4); aqui apenas se persiste o payload. A rota nasce sem
   * operador/equipa — a atribuição faz-se depois via PATCH.
   */
  async create(
    user: { userId: string; role: ContractUserRole },
    dto: CreateRotaDto,
  ): Promise<RotaRecord> {
    this.assertManager(user.role);
    const row = await this.prisma.rota.create({
      data: {
        nome: dto.nome,
        operador: '',
        estado: 'pendente',
        ecopontos: dto.paragens.length,
        distancia: dto.distancia,
        duracao: dto.duracao,
        waypoints: dto.waypoints as unknown as Prisma.InputJsonValue,
        geometria: dto.geometria as unknown as Prisma.InputJsonValue,
        paragens: dto.paragens as unknown as Prisma.InputJsonValue,
        zona: dto.zona ?? null,
        cor: dto.cor ?? '#60a5fa',
      },
    });
    return mapRow(row);
  }

  private assertManager(role: ContractUserRole): void {
    if (role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
      throw forbidden('FORBIDDEN');
    }
  }

  async update(
    id: string,
    dto: UpdateRotaDto,
    user: { userId: string; role: ContractUserRole },
  ): Promise<RotaRecord> {
    const isManager =
      user.role === UserRole.GESTOR || user.role === UserRole.ADMIN;

    if (user.role === UserRole.OPERADOR) {
      // Operador só pode mudar o estado (iniciar/concluir) e só nas suas rotas.
      if (
        dto.operadorId !== undefined ||
        dto.equipaId !== undefined ||
        dto.operador !== undefined
      ) {
        throw forbidden('FORBIDDEN');
      }
      const scope = await this.scopeForUser(user);
      const rota = await this.prisma.rota.findFirst({
        where: { AND: [{ id }, scope] },
        select: { id: true },
      });
      if (!rota) {
        // Existe mas não é dele → 403; não existe de todo → 404.
        const exists = await this.prisma.rota.findUnique({
          where: { id },
          select: { id: true },
        });
        throw exists ? forbidden('FORBIDDEN') : notFound('NOT_FOUND');
      }
    } else if (!isManager) {
      throw forbidden('FORBIDDEN');
    }

    const data: Prisma.RotaUpdateInput = {};
    if (dto.estado !== undefined) data.estado = dto.estado;

    if (isManager) {
      if (dto.operador !== undefined) data.operador = dto.operador;
      if (dto.equipaId !== undefined) {
        data.equipa =
          dto.equipaId === null
            ? { disconnect: true }
            : { connect: { id: dto.equipaId } };
      }
      if (dto.operadorId !== undefined) {
        if (dto.operadorId === null) {
          data.operadorRef = { disconnect: true };
        } else {
          const op = await this.prisma.user.findFirst({
            where: { id: dto.operadorId, role: UserRole.OPERADOR, eliminadoEm: null },
            select: { id: true, email: true },
          });
          if (!op) throw notFound('USER_NOT_FOUND');
          data.operadorRef = { connect: { id: op.id } };
          // Mantém o label de apresentação alinhado com o operador atribuído.
          if (dto.operador === undefined) data.operador = op.email;
        }
      }
    }

    try {
      const row = await this.prisma.rota.update({ where: { id }, data });
      return mapRow(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw notFound('NOT_FOUND');
      }
      throw err;
    }
  }

  /** Filtro Prisma de rotas visíveis para o utilizador (operador = só as suas). */
  private async scopeForUser(user: {
    userId: string;
    role: ContractUserRole;
  }): Promise<Prisma.RotaWhereInput> {
    if (user.role !== UserRole.OPERADOR) return {};
    const equipas = await this.prisma.equipaMembro.findMany({
      where: { userId: user.userId },
      select: { equipaId: true },
    });
    const equipaIds = equipas.map((e) => e.equipaId);
    return {
      OR: [
        { operadorId: user.userId },
        ...(equipaIds.length > 0 ? [{ equipaId: { in: equipaIds } }] : []),
      ],
    };
  }
}
