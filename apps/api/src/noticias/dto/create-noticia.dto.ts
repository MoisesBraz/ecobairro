import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateNoticiaRequest } from '@ecobairro/contracts';

export class CreateNoticiaDto implements CreateNoticiaRequest {
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsString()
  @IsNotEmpty()
  resumo!: string;

  @IsOptional()
  @IsString()
  conteudo?: string;

  @IsOptional()
  @IsString()
  imagem_url?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  destaque?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  tempo_leitura_min?: number;
}
