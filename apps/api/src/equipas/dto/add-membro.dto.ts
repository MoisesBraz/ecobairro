import { IsUUID } from 'class-validator';

export class AddMembroDto {
  @IsUUID()
  userId!: string;
}
