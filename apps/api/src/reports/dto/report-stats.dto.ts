import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReportStatsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  recentLimit?: number;

  @IsOptional()
  @IsIn(['me', 'global'])
  scope?: 'me' | 'global';
}
