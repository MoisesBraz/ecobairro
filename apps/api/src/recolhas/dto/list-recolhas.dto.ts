import { IsIn, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListRecolhasDto {
  @IsOptional()
  @IsIn(['pendente', 'agendado', 'concluido'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
