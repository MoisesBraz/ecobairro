import {
  Body,
  Controller,
  Get,
  Inject,
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
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecolhaDto,
  ) {
    return this.recolhasService.create(user.userId, dto);
  }
}
