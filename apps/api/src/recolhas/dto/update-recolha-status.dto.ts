import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { RecolhaStatus, UpdateRecolhaStatusRequest } from '@ecobairro/contracts';

const RECOLHA_STATUSES: RecolhaStatus[] = ['pendente', 'agendado', 'concluido'];

export class UpdateRecolhaStatusDto implements UpdateRecolhaStatusRequest {
  @IsIn(RECOLHA_STATUSES)
  status!: RecolhaStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'data_prevista deve estar no formato DD/MM/AAAA' })
  data_prevista?: string | null;
}
