import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCampanhaDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  corpo?: string;

  @IsOptional()
  @IsIn(['rascunho', 'publicada', 'expirada'])
  estado?: string;

  @IsOptional()
  @IsDateString()
  dataValidade?: string;
}
