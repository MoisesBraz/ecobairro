import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from './audit.service';
import { ListAuditDto } from './dto/list-audit.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  private readonly audit: AuditService;
  constructor(@Inject(AuditService) audit: AuditService) {
    this.audit = audit;
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAuditDto) {
    return this.audit.list(user.role, query);
  }
}
