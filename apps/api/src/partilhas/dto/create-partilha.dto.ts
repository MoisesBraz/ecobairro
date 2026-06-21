import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { CreatePartilhaRequest, PartilhaCategoria } from '@ecobairro/contracts';

const CATEGORIAS = ['moveis', 'eletro', 'livros', 'roupa'] as const;

export class CreatePartilhaDto implements CreatePartilhaRequest {
  @IsString()
  @MinLength(3)
  titulo!: string;

  @IsString()
  @MinLength(2)
  zona!: string;

  @IsIn(CATEGORIAS)
  categoria!: PartilhaCategoria;

  @IsOptional()
  @IsString()
  imagem_url?: string;
}
