import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  GamificationOptInResponse,
  QuizHistoryResponse,
  QuizMeResponse,
  QuizResultResponse,
  StartQuizResponse,
} from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GamificationService } from './gamification.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { ListQuizHistoryDto } from './dto/list-history.dto';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    @Inject(GamificationService) private readonly svc: GamificationService,
  ) {}

  // ── Opt-in (G1/G2) ──────────────────────────────────────────────────────

  @Post('optin')
  @HttpCode(HttpStatus.OK)
  optIn(@CurrentUser() user: AuthenticatedUser): Promise<GamificationOptInResponse> {
    return this.svc.setOptIn(user, true);
  }

  @Delete('optin')
  optOut(@CurrentUser() user: AuthenticatedUser): Promise<GamificationOptInResponse> {
    return this.svc.setOptIn(user, false);
  }

  // ── Resumo + quiz (G3 / RF-19) ──────────────────────────────────────────

  @Get('quiz/me')
  getQuizMe(@CurrentUser() user: AuthenticatedUser): Promise<QuizMeResponse> {
    return this.svc.getQuizMe(user);
  }

  @Post('quiz/iniciar')
  @HttpCode(HttpStatus.OK)
  iniciarQuiz(@CurrentUser() user: AuthenticatedUser): Promise<StartQuizResponse> {
    return this.svc.iniciarQuiz(user);
  }

  @Post('quiz/sessao/:sessaoId/responder')
  @HttpCode(HttpStatus.OK)
  responderQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessaoId', new ParseUUIDPipe()) sessaoId: string,
    @Body() body: SubmitQuizDto,
  ): Promise<QuizResultResponse> {
    return this.svc.responderQuiz(user, sessaoId, body);
  }

  @Get('quiz/historico')
  getHistorico(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQuizHistoryDto,
  ): Promise<QuizHistoryResponse> {
    return this.svc.getHistorico(user, query.page ?? 1, query.pageSize ?? 10);
  }
}
