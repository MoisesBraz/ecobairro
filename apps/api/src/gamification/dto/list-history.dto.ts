import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListQuizHistoryDto {
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
