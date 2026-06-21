import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import type { SubmitQuizAnswer, SubmitQuizRequest } from '@ecobairro/contracts';

class SubmitQuizAnswerDto implements SubmitQuizAnswer {
  @IsUUID()
  perguntaId!: string;

  @IsString()
  @IsUUID()
  opcaoId!: string;
}

export class SubmitQuizDto implements SubmitQuizRequest {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  respostas!: SubmitQuizAnswerDto[];
}
