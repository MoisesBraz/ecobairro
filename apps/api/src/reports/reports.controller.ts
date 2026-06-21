import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateReportResponse,
  ListReportsResponse,
  ReportStatsResponse,
  UpdateReportStatusResponse,
} from '@ecobairro/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { ReportStatsDto } from './dto/report-stats.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  private readonly reportsService: ReportsService;

  constructor(@Inject(ReportsService) reportsService: ReportsService) {
    this.reportsService = reportsService;
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateReportDto,
  ): Promise<CreateReportResponse> {
    return this.reportsService.createReport(user.userId, user.role, body);
  }

  @Get('me')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReportsDto,
  ): Promise<ListReportsResponse> {
    return this.reportsService.listMyReports(user.userId, user.role, query);
  }

  @Get('stats')
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportStatsDto,
  ): Promise<ReportStatsResponse> {
    return this.reportsService.getStats(
      user.userId,
      user.role,
      query.scope,
      query.recentLimit,
    );
  }

  @Get()
  listAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReportsDto,
  ): Promise<ListReportsResponse> {
    return this.reportsService.listReports(user.role, query);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() body: UpdateReportStatusDto,
  ): Promise<UpdateReportStatusResponse> {
    return this.reportsService.updateReportStatus(user.role, reportId, body);
  }
}
