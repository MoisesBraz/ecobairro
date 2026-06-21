import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FilaService } from './fila.service';
import { ListFilaDto } from './dto/list-fila.dto';
import { UpdateTarefaDto } from './dto/update-tarefa.dto';

@Controller('fila')
@UseGuards(JwtAuthGuard)
export class FilaController {
  private readonly fila: FilaService;
  constructor(@Inject(FilaService) fila: FilaService) {
    this.fila = fila;
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListFilaDto) {
    return this.fila.list(user.role, query);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTarefaDto,
  ) {
    return this.fila.update(user.role, id, dto);
  }
}
