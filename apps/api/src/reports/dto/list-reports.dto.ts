import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const REPORT_STATUS = ['pendente', 'analise', 'resolvido', 'rejeitado'] as const;
const REPORT_TIPOS = [
  'Ecoponto Cheio',
  'Deposição Ilegal',
  'Dano em Equipamento',
  'Odores',
  'Vandalismo',
] as const;

export class ListReportsDto {
  @IsOptional()
  @IsIn(REPORT_STATUS)
  status?: (typeof REPORT_STATUS)[number];

  @IsOptional()
  @IsIn(REPORT_TIPOS)
  tipo?: (typeof REPORT_TIPOS)[number];

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
