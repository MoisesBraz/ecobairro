import { IsIn } from 'class-validator';

const REPORT_STATUS = ['pendente', 'analise', 'resolvido', 'rejeitado'] as const;

export class UpdateReportStatusDto {
  @IsIn(REPORT_STATUS)
  status!: (typeof REPORT_STATUS)[number];
}
