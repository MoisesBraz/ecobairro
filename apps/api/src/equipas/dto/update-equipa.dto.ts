import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateEquipaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;
}
