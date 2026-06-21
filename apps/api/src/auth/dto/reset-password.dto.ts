import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, {
    message: 'A palavra-passe tem de incluir uma maiúscula, uma minúscula, um número e um caracter especial.',
  })
  new_password!: string;
}
