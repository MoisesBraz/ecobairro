import { IsIn } from 'class-validator';
import { ROLE_VALUES } from '../../users/roles.util';

export class UpdateUserRoleDto {
  @IsIn(ROLE_VALUES, { message: 'Papel inválido.' })
  role!: string;
}
