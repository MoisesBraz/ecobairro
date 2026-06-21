import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  AdminQuizOptionInput,
  CreateQuizQuestionRequest,
  QuizCategoria,
} from '@ecobairro/contracts';

/** Valores válidos de categoria (runtime) — alinhado com o enum `QuizCategoria`. */
export const QUIZ_CATEGORIAS: QuizCategoria[] = [
  'ORGANICOS',
  'RECICLAGEM',
  'LEGISLACAO',
  'GERAL',
];

export class QuizOptionDto implements AdminQuizOptionInput {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  texto!: string;

  @IsBoolean()
  correta!: boolean;
}

export class CreateQuizQuestionDto implements CreateQuizQuestionRequest {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  textoPergunta!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  explicacaoEducativa!: string;

  @IsIn(QUIZ_CATEGORIAS, { message: 'Categoria inválida.' })
  categoria!: QuizCategoria;

  @IsOptional()
  @IsInt()
  @Min(1)
  pontos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagemUrl?: string | null;

  // A invariante "exatamente 1 opção correta" é validada também no service
  // (regra de negócio), não só pelo tamanho do array aqui.
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  opcoes!: QuizOptionDto[];
}
