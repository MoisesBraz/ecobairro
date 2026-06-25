import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CampanhasService } from './campanhas.service';
import { ListCampanhasDto } from './dto/list-campanhas.dto';
import { CreateCampanhaDto } from './dto/create-campanha.dto';
import { UpdateCampanhaDto } from './dto/update-campanha.dto';

@Controller('campanhas')
export class CampanhasController {
  private readonly campanhas: CampanhasService;
  constructor(@Inject(CampanhasService) campanhas: CampanhasService) {
    this.campanhas = campanhas;
  }

  @Get('publicas')
  listPublicadas() {
    return this.campanhas.listPublicadas();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCampanhasDto) {
    return this.campanhas.list(user.role, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCampanhaDto,
  ) {
    return this.campanhas.create(user.role, dto, user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampanhaDto,
  ) {
    return this.campanhas.update(user.role, id, dto);
  }
}
