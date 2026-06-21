import { IsUUID } from 'class-validator';

export class AddFavoritoDto {
  @IsUUID()
  ecoponto_id!: string;
}
