import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateEcopontoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  morada?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ocupacao?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tipos?: string[];

  @IsOptional()
  @IsString()
  sensor_estado?: string;

  @IsOptional()
  @IsString()
  ultima_recolha?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsNumber()
  ordem?: number;
}
