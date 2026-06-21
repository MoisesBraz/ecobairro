import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsStrongPassword,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @IsStrongPassword({}, {
    message: 'A palavra-passe tem de incluir uma maiúscula, uma minúscula, um número e um caracter especial.',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome_completo?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  @Matches(/^\+?[\d\s\-().]+$/, { message: 'O número de telefone não é válido.' })
  phone?: string;

  @IsBoolean()
  @Equals(true)
  rgpd_accepted!: boolean;
}
