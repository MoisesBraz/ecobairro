import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

const REPORT_TIPOS = [
  'Ecoponto Cheio',
  'Deposição Ilegal',
  'Dano em Equipamento',
  'Odores',
  'Vandalismo',
] as const;

export class CreateReportDto {
  @IsString()
  @MinLength(3)
  titulo!: string;

  @IsIn(REPORT_TIPOS)
  tipo!: (typeof REPORT_TIPOS)[number];

  @IsString()
  @MinLength(10)
  descricao!: string;

  @IsString()
  @MinLength(3)
  local!: string;

  @IsOptional()
  @IsString()
  imagem?: string;

  // Georreferenciação opcional (R2/R8). Validar ambas; o serviço só persiste se vierem as duas.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
