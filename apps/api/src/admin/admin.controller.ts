import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ListRolesResponse, RegisterResponse } from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { buildRequestContext } from '../security/request-context.helper';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly svc: AdminService;
  constructor(@Inject(AdminService) svc: AdminService) {
    this.svc = svc;
  }

  /** Papéis disponíveis para os selects do frontend. */
  @Get('roles')
  listRoles(): ListRolesResponse {
    return this.svc.listRoles();
  }

  @Post('users')
  createUser(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: CreateUserDto,
  ): Promise<RegisterResponse> {
    return this.svc.createUser(user, ipOf(req), dto);
  }

  @Patch('users/:id/role')
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<{ id: string; role: string }> {
    return this.svc.updateRole(user, ipOf(req), id, dto.role);
  }

  @Delete('users/:id')
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string; ativo: boolean }> {
    return this.svc.deactivate(user, ipOf(req), id);
  }

  @Patch('users/:id/reativar')
  reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string; ativo: boolean }> {
    return this.svc.reactivate(user, ipOf(req), id);
  }
}

function ipOf(req: Request): string {
  return buildRequestContext(req).ipAddress;
}
