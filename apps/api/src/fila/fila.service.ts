import { Inject, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type {
  ListFilaResponse,
  TarefaRecord,
  UserRole as ContractUserRole,
} from '@ecobairro/contracts';
import type { ListFilaDto } from './dto/list-fila.dto';
import type { UpdateTarefaDto } from './dto/update-tarefa.dto';
import { forbidden } from '../common/errors';
import { parsePagination } from '../common/pagination';

// A fila de prioridades é uma ferramenta operacional de gestão.
function assertManager(role: ContractUserRole): void {
  if (role !== UserRole.GESTOR && role !== UserRole.ADMIN) {
    throw forbidden('FORBIDDEN');
  }
}

function mapRow(t: {
  id: string;
  titulo: string;
  local: string;
  tipo: string;
  prioridade: string;
  estado: string;
  atribuido: string | null;
  criadoEm: Date;
}): TarefaRecord {
  return {
    id: t.id,
    titulo: t.titulo,
    local: t.local,
    tipo: t.tipo,
    prioridade: t.prioridade as TarefaRecord['prioridade'],
    estado: t.estado as TarefaRecord['estado'],
    atribuido: t.atribuido,
    criado_em: t.criadoEm.toISOString(),
  };
}

@Injectable()
export class FilaService {
  private readonly prisma: PrismaService;
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async list(role: ContractUserRole, query: ListFilaDto): Promise<ListFilaResponse> {
    assertManager(role);
    const estado =
      query.estado && query.estado !== 'todos' ? query.estado : undefined;
    const { page, pageSize } = parsePagination(query.page, query.pageSize, 10, 100);
    const offset = (page - 1) * pageSize;

    const whereSql = estado
      ? Prisma.sql`WHERE estado = ${estado}`
      : Prisma.empty;

    // Ordenação por prioridade (crítica → baixa) feita na BD via CASE: a coluna
    // `prioridade` é texto, logo um orderBy normal do Prisma ordenaria
    // alfabeticamente e não respeitaria o ranking. Sem ordenação na BD a
    // paginação não faria sentido (a página 1 tem de trazer as mais críticas).
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        titulo: string;
        local: string;
        tipo: string;
        prioridade: string;
        estado: string;
        atribuido: string | null;
        criadoEm: Date;
      }[]
    >(Prisma.sql`
      SELECT id, titulo, local, tipo, prioridade, estado, atribuido,
             criado_em AS "criadoEm"
      FROM tarefas
      ${whereSql}
      ORDER BY CASE prioridade
                 WHEN 'critica' THEN 0
                 WHEN 'alta'    THEN 1
                 WHEN 'normal'  THEN 2
                 WHEN 'baixa'   THEN 3
                 ELSE 4
               END ASC,
               criado_em ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tarefas ${whereSql}`,
    );
    const total = Number(countRows[0]?.count ?? 0);

    return { tarefas: rows.map(mapRow), total, page, pageSize };
  }

  async update(role: ContractUserRole, id: string, dto: UpdateTarefaDto) {
    assertManager(role);
    const row = await this.prisma.tarefa.update({
      where: { id },
      data: {
        ...(dto.prioridade !== undefined && { prioridade: dto.prioridade }),
        ...(dto.estado !== undefined && { estado: dto.estado }),
        ...(dto.atribuido !== undefined && { atribuido: dto.atribuido }),
      },
    });
    return mapRow(row);
  }
}
