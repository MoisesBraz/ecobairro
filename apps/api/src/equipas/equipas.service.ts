import { Inject, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type {
  EquipaRecord,
  ListEquipasResponse,
  ListOperadoresResponse,
  RotaEstado,
  UserRole as ContractUserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { conflict, forbidden, notFound } from '../common/errors';
import type { CreateEquipaDto } from './dto/create-equipa.dto';
import type { UpdateEquipaDto } from './dto/update-equipa.dto';
import type { AddMembroDto } from './dto/add-membro.dto';

type EquipaWithRelations = Prisma.EquipaGetPayload<{
  include: {
    membros: { include: { user: { select: { id: true; email: true } } } };
    rotas: { select: { id: true; nome: true; estado: true; operadorId: true } };
  };
}>;

function mapEquipa(e: EquipaWithRelations): EquipaRecord {
  return {
    id: e.id,
    nome: e.nome,
    membros: e.membros.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
    })),
    rotas: e.rotas.map((r) => ({
      id: r.id,
      nome: r.nome,
      estado: r.estado as RotaEstado,
      operadorId: r.operadorId,
    })),
  };
}

const EQUIPA_INCLUDE = {
  membros: { include: { user: { select: { id: true, email: true } } } },
  rotas: { select: { id: true, nome: true, estado: true, operadorId: true } },
} satisfies Prisma.EquipaInclude;

/**
 * Gestão de equipas reservada a gestor/admin. Controlo de acesso ao nível do
 * service (`assertManager`), seguindo o padrão de `AdminService.assertAdmin`.
 */
@Injectable()
export class EquipasService {
  private readonly prisma: PrismaService;
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listOperadores(role: ContractUserRole): Promise<ListOperadoresResponse> {
    this.assertManager(role);
    const rows = await this.prisma.user.findMany({
      where: { role: UserRole.OPERADOR, eliminadoEm: null },
      select: { id: true, email: true },
      orderBy: { email: 'asc' },
    });
    return { operadores: rows };
  }

  async list(role: ContractUserRole): Promise<ListEquipasResponse> {
    this.assertManager(role);
    const rows = await this.prisma.equipa.findMany({
      orderBy: { criadoEm: 'asc' },
      include: EQUIPA_INCLUDE,
    });
    return { equipas: rows.map(mapEquipa), total: rows.length };
  }

  async create(role: ContractUserRole, dto: CreateEquipaDto): Promise<EquipaRecord> {
    this.assertManager(role);
    const row = await this.prisma.equipa.create({
      data: { nome: dto.nome },
      include: EQUIPA_INCLUDE,
    });
    return mapEquipa(row);
  }

  async update(
    role: ContractUserRole,
    id: string,
    dto: UpdateEquipaDto,
  ): Promise<EquipaRecord> {
    this.assertManager(role);
    try {
      const row = await this.prisma.equipa.update({
        where: { id },
        data: { nome: dto.nome },
        include: EQUIPA_INCLUDE,
      });
      return mapEquipa(row);
    } catch (err) {
      throw this.mapNotFound(err);
    }
  }

  async remove(role: ContractUserRole, id: string): Promise<{ ok: true }> {
    this.assertManager(role);
    try {
      await this.prisma.equipa.delete({ where: { id } });
      return { ok: true };
    } catch (err) {
      throw this.mapNotFound(err);
    }
  }

  async addMembro(
    role: ContractUserRole,
    equipaId: string,
    dto: AddMembroDto,
  ): Promise<EquipaRecord> {
    this.assertManager(role);

    const equipa = await this.prisma.equipa.findUnique({
      where: { id: equipaId },
      select: { id: true },
    });
    if (!equipa) throw notFound('NOT_FOUND');

    const operador = await this.prisma.user.findFirst({
      where: { id: dto.userId, role: UserRole.OPERADOR, eliminadoEm: null },
      select: { id: true },
    });
    if (!operador) throw notFound('USER_NOT_FOUND');

    try {
      await this.prisma.equipaMembro.create({
        data: { equipaId, userId: dto.userId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw conflict('CONFLICT'); // já é membro
      }
      throw err;
    }

    return this.getOrThrow(equipaId);
  }

  async removeMembro(
    role: ContractUserRole,
    equipaId: string,
    userId: string,
  ): Promise<EquipaRecord> {
    this.assertManager(role);
    await this.prisma.equipaMembro.deleteMany({ where: { equipaId, userId } });
    return this.getOrThrow(equipaId);
  }

  private async getOrThrow(id: string): Promise<EquipaRecord> {
    const row = await this.prisma.equipa.findUnique({
      where: { id },
      include: EQUIPA_INCLUDE,
    });
    if (!row) throw notFound('NOT_FOUND');
    return mapEquipa(row);
  }

  private mapNotFound(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFound('NOT_FOUND');
    }
    return err;
  }

  private assertManager(role: ContractUserRole): void {
    if (role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
      throw forbidden('FORBIDDEN');
    }
  }
}
