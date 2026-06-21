import { IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateCidadaoProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  @Matches(/^\+?[\d\s\-().]+$/, { message: 'O número de telemóvel não é válido.' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome_completo?: string;

  @IsOptional()
  @IsBoolean()
  gamification_opt_in?: boolean;

  @IsOptional()
  @IsObject()
  notificacao_prefs?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  dashboard_widgets?: Record<string, unknown>;
}
