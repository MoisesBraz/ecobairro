import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateEcopontoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  morada!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ocupacao!: number;

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

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  ordem?: number;
}
