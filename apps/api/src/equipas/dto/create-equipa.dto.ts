import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEquipaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;
}
