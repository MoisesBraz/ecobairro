import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateEcopontoRequest,
  EcopontoNivel,
  EcopontoRecord,
  EcopontoSensor,
  ListEcopontosQuery,
  ListEcopontosResponse,
  UpdateEcopontoRequest,
  UserRole,
} from '@ecobairro/contracts';
import { PrismaService } from '../database/prisma.service';
import { resolveZona } from './zona.helper';
import { isWithinAveiro } from '../common/geo';
import { badRequest, forbidden, notFound } from '../common/errors';
import { parsePagination } from '../common/pagination';

function computeNivel(ocupacao: number): EcopontoNivel {
  if (ocupacao >= 95) return 'cheio';
  if (ocupacao >= 80) return 'alto';
  if (ocupacao >= 50) return 'medio';
  return 'baixo';
}

/**
 * Intervalo de `ocupacao` equivalente a cada nível (inverso de `computeNivel`).
 * Usado para empurrar o filtro de nível para o `where` do Prisma — sem isto a
 * paginação por BD daria contagens/páginas erradas (o filtro era em memória).
 */
function nivelToOcupacao(
  nivel: EcopontoNivel,
): Record<string, number> {
  switch (nivel) {
    case 'cheio':
      return { gte: 95 };
    case 'alto':
      return { gte: 80, lt: 95 };
    case 'medio':
      return { gte: 50, lt: 80 };
    case 'baixo':
    default:
      return { lt: 50 };
  }
}

const WRITER_ROLES: UserRole[] = [
  'OPERADOR',
  'GESTOR',
  'ADMIN',
];

function assertWriter(role: UserRole): void {
  if (!WRITER_ROLES.includes(role)) {
    throw forbidden('FORBIDDEN');
  }
}

/** Só se aceitam ecopontos dentro do concelho de Aveiro (defesa contra POST/PATCH directos). */
function assertDentroAveiro(lat: number, lng: number): void {
  if (!isWithinAveiro(lat, lng)) {
    throw badRequest(
      'VALIDATION_ERROR',
      'Coordenadas fora do concelho de Aveiro.',
    );
  }
}

function mapRow(row: {
  id: string;
  nome: string;
  codigo: string | null;
  morada: string;
  codigoPostal: string | null;
  zona: string | null;
  distanciaLabel: string;
  ocupacao: number;
  tipos: unknown;
  sensorEstado: string;
  ultimaRecolha: string | null;
  ultimaAtualizacao: string | null;
  lat: number;
  lng: number;
  bateria: number | null;
  temperatura: number | null;
  ativo: boolean;
  ordem: number;
}): EcopontoRecord {
  const tipos = Array.isArray(row.tipos) ? (row.tipos as string[]) : [];
  return {
    id: row.id,
    nome: row.nome,
    codigo: row.codigo,
    morada: row.morada,
    codigo_postal: row.codigoPostal,
    zona: row.zona,
    distancia_label: row.distanciaLabel,
    ocupacao: row.ocupacao,
    nivel: computeNivel(row.ocupacao),
    tipos,
    sensor_estado: row.sensorEstado as EcopontoSensor,
    ultima_recolha: row.ultimaRecolha,
    ultima_atualizacao: row.ultimaAtualizacao,
    lat: row.lat,
    lng: row.lng,
    bateria: row.bateria,
    temperatura: row.temperatura,
    ativo: row.ativo,
    ordem: row.ordem,
  };
}

@Injectable()
export class EcopontosService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(query: ListEcopontosQuery = {}): Promise<ListEcopontosResponse> {
    const { q, zona, codigo_postal, tipo, nivel, todos } = query;
    const apenasAtivos = !todos;

    // Condições dinâmicas
    const where: Prisma.EcopontoWhereInput = {};
    if (apenasAtivos) where['ativo'] = true;

    if (zona) where['zona'] = { equals: zona, mode: Prisma.QueryMode.insensitive };

    if (codigo_postal) {
      where['codigoPostal'] = { startsWith: codigo_postal, mode: Prisma.QueryMode.insensitive };
    }

    if (q) {
      const contains = { contains: q, mode: Prisma.QueryMode.insensitive };
      where['OR'] = [
        { nome: contains },
        { morada: contains },
        { codigoPostal: contains },
        { zona: contains },
      ];
    }

    // tipo (array JSON) e nível (computado de ocupacao) vão para o `where` para
    // que a paginação por BD seja exacta (contagem/skip/take corretos).
    if (tipo) where['tipos'] = { array_contains: tipo };
    if (nivel) where['ocupacao'] = nivelToOcupacao(nivel);

    // Paginação opt-in: só quando `page` é fornecido. As vistas de mapa/agregação
    // (zonas, mapa-sensores, home) não enviam `page` e continuam a receber tudo.
    const paginar = query.page !== undefined;

    if (!paginar) {
      const rows = await this.prisma.ecoponto.findMany({
        where,
        orderBy: { ordem: 'asc' },
      });
      const ecopontos = rows.map(mapRow);
      return { ecopontos, total: ecopontos.length };
    }

    const { page, pageSize } = parsePagination(query.page, query.pageSize, 10, 100);
    const skip = (page - 1) * pageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ecoponto.findMany({
        where,
        orderBy: { ordem: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.ecoponto.count({ where }),
    ]);

    return { ecopontos: rows.map(mapRow), total, page, pageSize };
  }

  /**
   * Zonas distintas (ativas), para popular o filtro de zona sem carregar todos
   * os ecopontos — necessário porque a listagem passou a ser paginada.
   */
  async zonas(): Promise<{ zonas: string[] }> {
    const rows = await this.prisma.ecoponto.findMany({
      where: { ativo: true },
      select: { zona: true },
      distinct: ['zona'],
      orderBy: { zona: 'asc' },
    });
    const zonas = rows
      .map((r) => r.zona)
      .filter((z): z is string => !!z);
    return { zonas };
  }

  async create(
    role: UserRole,
    input: CreateEcopontoRequest,
  ): Promise<EcopontoRecord> {
    assertWriter(role);
    assertDentroAveiro(input.lat, input.lng);
    // Zona é derivada da localização: herda a do vizinho mais próximo (<=50 m)
    // ou é nomeada pela morada se o ponto estiver isolado.
    const existentes = await this.prisma.ecoponto.findMany({
      where: { ativo: true },
      select: { lat: true, lng: true, zona: true },
      orderBy: { ordem: 'asc' },
    });
    const zona = resolveZona(input.lat, input.lng, input.morada, existentes);
    const row = await this.prisma.ecoponto.create({
      data: {
        nome: input.nome,
        codigo: input.codigo ?? null,
        morada: input.morada,
        zona,
        ocupacao: input.ocupacao,
        tipos: input.tipos ?? [],
        sensorEstado: input.sensor_estado ?? 'online',
        ultimaRecolha: input.ultima_recolha ?? null,
        lat: input.lat,
        lng: input.lng,
        ordem: input.ordem ?? 0,
      },
    });
    return mapRow(row);
  }

  async update(
    role: UserRole,
    id: string,
    input: UpdateEcopontoRequest,
  ): Promise<EcopontoRecord> {
    assertWriter(role);
    const atual = await this.prisma.ecoponto.findUnique({ where: { id } });
    if (!atual) {
      throw notFound('ECOPONTO_NOT_FOUND');
    }

    // Recalcular a zona apenas quando a localização muda; os restantes campos
    // não afetam o agrupamento por proximidade.
    const localizacaoMudou = input.lat !== undefined || input.lng !== undefined;
    let zonaUpdate: { zona?: string } = {};
    if (localizacaoMudou) {
      const lat = input.lat ?? atual.lat;
      const lng = input.lng ?? atual.lng;
      assertDentroAveiro(lat, lng);
      const morada = input.morada ?? atual.morada;
      const existentes = await this.prisma.ecoponto.findMany({
        where: { ativo: true, id: { not: id } },
        select: { lat: true, lng: true, zona: true },
        orderBy: { ordem: 'asc' },
      });
      zonaUpdate = { zona: resolveZona(lat, lng, morada, existentes) };
    }

    try {
      const row = await this.prisma.ecoponto.update({
        where: { id },
        data: {
          ...(input.nome !== undefined && { nome: input.nome }),
          ...(input.codigo !== undefined && { codigo: input.codigo }),
          ...(input.morada !== undefined && { morada: input.morada }),
          ...zonaUpdate,
          ...(input.ocupacao !== undefined && { ocupacao: input.ocupacao }),
          ...(input.tipos !== undefined && { tipos: input.tipos }),
          ...(input.sensor_estado !== undefined && { sensorEstado: input.sensor_estado }),
          ...(input.ultima_recolha !== undefined && { ultimaRecolha: input.ultima_recolha }),
          ...(input.lat !== undefined && { lat: input.lat }),
          ...(input.lng !== undefined && { lng: input.lng }),
          ...(input.ativo !== undefined && { ativo: input.ativo }),
          ...(input.ordem !== undefined && { ordem: input.ordem }),
        },
      });
      return mapRow(row);
    } catch {
      throw notFound('ECOPONTO_NOT_FOUND');
    }
  }

  async remove(role: UserRole, id: string): Promise<void> {
    assertWriter(role);
    const result = await this.prisma.ecoponto.updateMany({
      where: { id },
      data: { ativo: false },
    });
    if (result.count === 0) {
      throw notFound('ECOPONTO_NOT_FOUND');
    }
  }
}
