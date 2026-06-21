import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { QuizCategoria, UpdateQuizQuestionRequest } from '@ecobairro/contracts';
import { QUIZ_CATEGORIAS, QuizOptionDto } from './create-quiz-question.dto';

export class UpdateQuizQuestionDto implements UpdateQuizQuestionRequest {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  textoPergunta?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  explicacaoEducativa?: string;

  @IsOptional()
  @IsIn(QUIZ_CATEGORIAS, { message: 'Categoria inválida.' })
  categoria?: QuizCategoria;

  @IsOptional()
  @IsInt()
  @Min(1)
  pontos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagemUrl?: string | null;

  // Quando presente, substitui todas as opções (delete + recreate no service).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  opcoes?: QuizOptionDto[];
}
