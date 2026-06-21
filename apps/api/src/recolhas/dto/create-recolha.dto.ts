import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRecolhaDto {
  @IsString()
  @MinLength(2)
  tipo!: string;

  @IsString()
  @MinLength(2)
  subtipo!: string;

  @IsString()
  @MinLength(5)
  morada!: string;

  @IsOptional()
  @IsString()
  obs?: string;
}
