import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ROLE_VALUES } from '../../users/roles.util';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsIn(ROLE_VALUES, { message: 'Papel inválido.' })
  role!: string;
}
