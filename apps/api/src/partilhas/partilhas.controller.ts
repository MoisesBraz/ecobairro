import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreatePartilhaResponse,
  ExpressPartilhaInterestResponse,
  ListPartilhasResponse,
} from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CreatePartilhaDto } from './dto/create-partilha.dto';
import { ExpressInterestDto } from './dto/express-interest.dto';
import { ListPartilhasDto } from './dto/list-partilhas.dto';
import { PartilhasService } from './partilhas.service';

@Controller('partilhas')
export class PartilhasController {
  private readonly svc: PartilhasService;

  constructor(@Inject(PartilhasService) svc: PartilhasService) {
    this.svc = svc;
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: ListPartilhasDto): Promise<ListPartilhasResponse> {
    return this.svc.list(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePartilhaDto,
  ): Promise<CreatePartilhaResponse> {
    return this.svc.create(user.userId, user.role, body);
  }

  @Post(':id/interesse')
  @UseGuards(JwtAuthGuard)
  interesse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ExpressInterestDto,
  ): Promise<ExpressPartilhaInterestResponse> {
    return this.svc.expressInterest(user.userId, id, body);
  }
}
