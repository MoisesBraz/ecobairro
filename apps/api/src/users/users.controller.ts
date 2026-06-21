import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { ListUsersResponse } from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly svc: UsersService;
  constructor(@Inject(UsersService) svc: UsersService) { this.svc = svc; }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ): Promise<ListUsersResponse> {
    return this.svc.list(user.role, {
      role:     query['role'],
      q:        query['q'],
      ativo:    query['ativo'] !== undefined ? query['ativo'] === 'true' : undefined,
      page:     query['page']     ? Number(query['page'])     : undefined,
      pageSize: query['pageSize'] ? Number(query['pageSize']) : undefined,
    });
  }
}
