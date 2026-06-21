import { IsString, Length, Matches } from 'class-validator';

export class EnableTwoFactorDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'O código TOTP tem de ser 6 dígitos.' })
  code!: string;
}
