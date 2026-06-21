import { IsString, MinLength } from 'class-validator';

/**
 * Usado nos endpoints sensíveis que pedem re-confirmação de password:
 * desativar 2FA, regenerar/revelar backup codes.
 */
export class PasswordConfirmDto {
  @IsString()
  @MinLength(6)
  password!: string;
}
