import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateCampanhaDto {
  @IsString()
  @MinLength(3)
  titulo!: string;

  @IsString()
  @MinLength(10)
  corpo!: string;

  @IsDateString()
  dataValidade!: string;
}
