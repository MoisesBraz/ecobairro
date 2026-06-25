import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { RotasService } from './rotas.service';
import { UpdateRotaDto } from './dto/update-rota.dto';
import { CreateRotaDto } from './dto/create-rota.dto';

@Controller('rotas')
@UseGuards(JwtAuthGuard)
export class RotasController {
  private readonly rotas: RotasService;
  constructor(@Inject(RotasService) rotas: RotasService) {
    this.rotas = rotas;
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.rotas.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRotaDto) {
    return this.rotas.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRotaDto,
  ) {
    return this.rotas.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotas.remove(id, user);
  }
}
