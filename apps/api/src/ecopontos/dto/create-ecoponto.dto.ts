import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class CreateContentorDto {
  @IsString()
  tipo!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ocupacao!: number;

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

export class CreateEcopontoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  morada!: string;

  @IsOptional()
  @IsString()
  zona?: string;

  @IsOptional()
  @IsArray()
  @Type(() => CreateContentorDto)
  contentores?: CreateContentorDto[];

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @IsOptional()
  @IsNumber()
  ordem?: number;
}
