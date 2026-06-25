import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { ExpressPartilhaInterestRequest } from '@ecobairro/contracts';

export class ExpressInterestDto implements ExpressPartilhaInterestRequest {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A mensagem não pode exceder 500 caracteres.' })
  mensagem?: string;
}
