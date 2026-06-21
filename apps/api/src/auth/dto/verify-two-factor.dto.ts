import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @Length(16, 256)
  pre_auth_token!: string;

  // Aceita TOTP (6 dígitos) ou backup code (11 chars com hífen)
  @IsString()
  @Length(6, 32)
  code!: string;
}
