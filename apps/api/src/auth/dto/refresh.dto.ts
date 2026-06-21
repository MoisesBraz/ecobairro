import { IsString, MinLength, IsOptional } from 'class-validator';

export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  refresh_token?: string;
}
