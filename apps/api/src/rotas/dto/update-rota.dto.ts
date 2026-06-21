import { IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateRotaDto {
  @IsOptional()
  @IsIn(['ativa', 'concluida', 'pendente'])
  estado?: string;

  @IsOptional()
  @IsString()
  operador?: string;

  // Atribuição de operador (gestor/admin). `null` desatribui.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  operadorId?: string | null;

  // Atribuição de equipa (gestor/admin). `null` desatribui.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  equipaId?: string | null;
}
