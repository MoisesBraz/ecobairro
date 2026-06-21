import { Controller, Get, Post, Body, Inject, Param, Query, NotFoundException, UseGuards, ForbiddenException } from '@nestjs/common';
import type { ListNoticiasResponse, GetNoticiaResponse, CreateNoticiaResponse } from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ListNoticiasDto } from './dto/list-noticias.dto';
import { CreateNoticiaDto } from './dto/create-noticia.dto';
import { NoticiasService } from './noticias.service';

@Controller('noticias')
export class NoticiasController {
  private readonly svc: NoticiasService;
  constructor(@Inject(NoticiasService) svc: NoticiasService) { this.svc = svc; }

  @Get()
  list(@Query() query: ListNoticiasDto): Promise<ListNoticiasResponse> {
    return this.svc.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<GetNoticiaResponse> {
    const noticia = await this.svc.getById(id);
    if (!noticia) {
      throw new NotFoundException('Notícia não encontrada');
    }
    return { noticia };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNoticiaDto
  ): Promise<CreateNoticiaResponse> {
    if (user.role !== 'ADMIN' && user.role !== 'GESTOR' && user.role !== 'OPERADOR') {
      throw new ForbiddenException('Não tem permissões para adicionar notícias.');
    }
    const noticia = await this.svc.create(dto);
    return { noticia };
  }
}
