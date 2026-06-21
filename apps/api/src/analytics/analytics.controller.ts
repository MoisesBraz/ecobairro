import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { AnalyticsResponse } from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  private readonly svc: AnalyticsService;
  constructor(@Inject(AnalyticsService) svc: AnalyticsService) { this.svc = svc; }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<AnalyticsResponse> {
    return this.svc.getAnalytics(user.role);
  }
}
