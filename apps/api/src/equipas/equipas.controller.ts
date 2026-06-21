import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EquipasService } from './equipas.service';
import { CreateEquipaDto } from './dto/create-equipa.dto';
import { UpdateEquipaDto } from './dto/update-equipa.dto';
import { AddMembroDto } from './dto/add-membro.dto';

@Controller('equipas')
@UseGuards(JwtAuthGuard)
export class EquipasController {
  private readonly equipas: EquipasService;
  constructor(@Inject(EquipasService) equipas: EquipasService) {
    this.equipas = equipas;
  }

  @Get('operadores')
  listOperadores(@CurrentUser() user: AuthenticatedUser) {
    return this.equipas.listOperadores(user.role);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.equipas.list(user.role);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEquipaDto,
  ) {
    return this.equipas.create(user.role, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipaDto,
  ) {
    return this.equipas.update(user.role, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.equipas.remove(user.role, id);
  }

  @Post(':id/membros')
  addMembro(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMembroDto,
  ) {
    return this.equipas.addMembro(user.role, id, dto);
  }

  @Delete(':id/membros/:userId')
  removeMembro(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.equipas.removeMembro(user.role, id, userId);
  }
}
