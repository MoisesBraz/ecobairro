import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTarefaDto {
  @IsOptional()
  @IsIn(['critica', 'alta', 'normal', 'baixa'])
  prioridade?: string;

  @IsOptional()
  @IsIn(['pendente', 'em_curso', 'resolvido'])
  estado?: string;

  @IsOptional()
  @IsString()
  atribuido?: string | null;
}
