import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  CitizenSelfProfileResponse,
  ListFavoritosResponse,
} from '@ecobairro/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CidadaosService } from './cidadaos.service';
import { UpdateCidadaoProfileDto } from './dto/update-cidadao-profile.dto';
import { AddFavoritoDto } from './dto/add-favorito.dto';

@Controller('cidadaos')
@UseGuards(JwtAuthGuard)
export class CidadaosController {
  private readonly cidadaosService: CidadaosService;

  constructor(@Inject(CidadaosService) cidadaosService: CidadaosService) {
    this.cidadaosService = cidadaosService;
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<CitizenSelfProfileResponse> {
    return this.cidadaosService.getMe(user.userId, user.role);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCidadaoProfileDto,
  ): Promise<CitizenSelfProfileResponse> {
    return this.cidadaosService.updateMe(user.userId, user.role, body);
  }

  @Get('me/favoritos')
  listFavoritos(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ListFavoritosResponse> {
    return this.cidadaosService.listFavoritos(user.userId, user.role);
  }

  @Post('me/favoritos')
  addFavorito(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddFavoritoDto,
  ): Promise<ListFavoritosResponse> {
    return this.cidadaosService.addFavorito(
      user.userId,
      user.role,
      body.ecoponto_id,
    );
  }

  @Delete('me/favoritos/:ecopontoId')
  removeFavorito(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ecopontoId') ecopontoId: string,
  ): Promise<ListFavoritosResponse> {
    return this.cidadaosService.removeFavorito(
      user.userId,
      user.role,
      ecopontoId,
    );
  }
}
