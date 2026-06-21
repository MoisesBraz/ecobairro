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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  AdminQuizQuestion,
  ListAdminQuizQuestionsResponse,
} from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { buildRequestContext } from '../security/request-context.helper';
import { QuizAdminService } from './quiz-admin.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';

/**
 * Gestão de perguntas do quiz (GESTOR/ADMIN). Acesso garantido ao nível do
 * service (`assertManager`); o `JwtAuthGuard` apenas valida o token.
 */
@Controller('admin/quiz')
@UseGuards(JwtAuthGuard)
export class QuizAdminController {
  constructor(
    @Inject(QuizAdminService) private readonly svc: QuizAdminService,
  ) {}

  @Get('perguntas')
  list(@CurrentUser() user: AuthenticatedUser): Promise<ListAdminQuizQuestionsResponse> {
    return this.svc.list(user);
  }

  @Post('perguntas')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: CreateQuizQuestionDto,
  ): Promise<AdminQuizQuestion> {
    return this.svc.create(user, ipOf(req), dto);
  }

  @Patch('perguntas/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuizQuestionDto,
  ): Promise<AdminQuizQuestion> {
    return this.svc.update(user, ipOf(req), id, dto);
  }

  @Delete('perguntas/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ id: string; removed: boolean }> {
    return this.svc.remove(user, ipOf(req), id);
  }
}

function ipOf(req: Request): string {
  return buildRequestContext(req).ipAddress;
}
