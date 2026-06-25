import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class UpdateContentorDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ocupacao?: number;

  @IsOptional()
  @IsString()
  sensor_estado?: string;

  @IsOptional()
  @IsNumber()
  bateria?: number;

  @IsOptional()
  @IsString()
  ultima_recolha?: string;
}

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
  @IsString()
  zona?: string;

  @IsOptional()
  @IsArray()
  @Type(() => UpdateContentorDto)
  contentores?: UpdateContentorDto[];

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsNumber()
  ordem?: number;
}
