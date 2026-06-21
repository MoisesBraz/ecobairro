import { Inject, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type {
  CitizenSelfProfileResponse,
  HomeEcoponto,
  ListFavoritosResponse,
  UpdateCitizenSelfProfileRequest,
  UserRole as ContractUserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { conflict, forbidden, notFound } from '../common/errors';

@Injectable()
export class CidadaosService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getMe(userId: string, role: ContractUserRole): Promise<CitizenSelfProfileResponse> {
    assertCitizen(role);
    return this.fetchProfile(userId);
  }

  async updateMe(
    userId: string,
    role: ContractUserRole,
    input: UpdateCitizenSelfProfileRequest,
  ): Promise<CitizenSelfProfileResponse> {
    assertCitizen(role);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { cidadaoPerfil: true },
      });

      if (!user || user.eliminadoEm || !user.cidadaoPerfil) {
        throw notFound('CITIZEN_PROFILE_NOT_FOUND');
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          phone: input.phone ?? user.phone,
        },
      });

      await tx.cidadaoPerfil.update({
        where: { userId },
        data: buildProfileUpdateData(input),
      });
    });

    return this.fetchProfile(userId);
  }

  async listFavoritos(
    userId: string,
    role: ContractUserRole,
  ): Promise<ListFavoritosResponse> {
    assertCitizen(role);
    const rows = await this.prisma.cidadaoEcopontoFavorito.findMany({
      where: { userId, ecoponto: { ativo: true } },
      include: { ecoponto: true },
      orderBy: { criadoEm: 'asc' },
    });
    return {
      ecopontos: rows.map((row) => mapEcopontoFavorito(row.ecoponto)),
    };
  }

  async addFavorito(
    userId: string,
    role: ContractUserRole,
    ecopontoId: string,
  ): Promise<ListFavoritosResponse> {
    assertCitizen(role);

    const ecoponto = await this.prisma.ecoponto.findFirst({
      where: { id: ecopontoId, ativo: true },
    });
    if (!ecoponto) {
      throw notFound('ECOPONTO_NOT_FOUND');
    }

    try {
      await this.prisma.cidadaoEcopontoFavorito.create({
        data: { userId, ecopontoId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw conflict('ECOPONTO_ALREADY_FAVORITE');
      }
      throw error;
    }

    return this.listFavoritos(userId, role);
  }

  async removeFavorito(
    userId: string,
    role: ContractUserRole,
    ecopontoId: string,
  ): Promise<ListFavoritosResponse> {
    assertCitizen(role);

    await this.prisma.cidadaoEcopontoFavorito.deleteMany({
      where: { userId, ecopontoId },
    });

    return this.listFavoritos(userId, role);
  }

  private async fetchProfile(userId: string): Promise<CitizenSelfProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { cidadaoPerfil: true },
    });

    if (!user || user.eliminadoEm || !user.cidadaoPerfil) {
      throw notFound('CITIZEN_PROFILE_NOT_FOUND');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: 'CIDADAO',
      email_verified: user.emailVerified,
      nome_completo: user.cidadaoPerfil.nomeCompleto,
      gamification_opt_in: user.cidadaoPerfil.gamificationOptIn,
      notificacao_prefs: asJsonObject(user.cidadaoPerfil.notificacaoPrefs),
      dashboard_widgets: asJsonObject(user.cidadaoPerfil.dashboardWidgets),
      criado_em: user.criadoEm.toISOString(),
    };
  }
}

function mapEcopontoFavorito(e: {
  id: string;
  nome: string;
  distanciaLabel: string;
  ocupacao: number;
  mapTileUrl: string | null;
}): HomeEcoponto {
  return {
    id: e.id,
    nome: e.nome,
    distancia: e.distanciaLabel,
    ocupacao: e.ocupacao,
    map_url: e.mapTileUrl ?? '',
  };
}

function assertCitizen(role: ContractUserRole): asserts role is 'CIDADAO' {
  if (role !== UserRole.CIDADAO) {
    throw forbidden('FORBIDDEN');
  }
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function buildProfileUpdateData(
  input: UpdateCitizenSelfProfileRequest,
): Prisma.CidadaoPerfilUpdateInput {
  const data: Prisma.CidadaoPerfilUpdateInput = {};

  if (input.nome_completo !== undefined) {
    data.nomeCompleto = input.nome_completo;
  }

  if (input.gamification_opt_in !== undefined) {
    data.gamificationOptIn = input.gamification_opt_in;
  }

  if (input.notificacao_prefs !== undefined) {
    data.notificacaoPrefs = input.notificacao_prefs as Prisma.InputJsonValue;
  }

  if (input.dashboard_widgets !== undefined) {
    data.dashboardWidgets = input.dashboard_widgets as Prisma.InputJsonValue;
  }

  return data;
}
