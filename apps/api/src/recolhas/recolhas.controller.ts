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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RecolhasService } from './recolhas.service';
import { ListRecolhasDto } from './dto/list-recolhas.dto';
import { CreateRecolhaDto } from './dto/create-recolha.dto';
import { UpdateRecolhaStatusDto } from './dto/update-recolha-status.dto';

@Controller('recolhas')
@UseGuards(JwtAuthGuard)
export class RecolhasController {
  private readonly recolhasService: RecolhasService;

  constructor(@Inject(RecolhasService) recolhasService: RecolhasService) {
    this.recolhasService = recolhasService;
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRecolhasDto,
  ) {
    return this.recolhasService.list(user.userId, user.role, query);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecolhaDto,
  ) {
    const recolha = await this.recolhasService.create(user.userId, dto);
    return { recolha };
  }

  @Delete(':id')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const recolha = await this.recolhasService.cancel(user.userId, user.role, id);
    return { recolha };
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRecolhaStatusDto,
  ) {
    const recolha = await this.recolhasService.updateStatus(user.role, id, dto);
    return { recolha };
  }
}
