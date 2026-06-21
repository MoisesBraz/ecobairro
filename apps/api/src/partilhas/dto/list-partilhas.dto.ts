import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { ListPartilhasQuery } from '@ecobairro/contracts';

const CATEGORIAS = ['moveis', 'eletro', 'livros', 'roupa'] as const;

export class ListPartilhasDto implements ListPartilhasQuery {
  @IsOptional()
  @IsIn(CATEGORIAS)
  categoria?: (typeof CATEGORIAS)[number];

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize?: number;
}
