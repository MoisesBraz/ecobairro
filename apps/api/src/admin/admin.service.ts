import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ListRolesResponse,
  RegisterResponse,
  UserRole as ContractRole,
} from '@ecobairro/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SecurityService } from '../security/security.service';
import { SessionService } from '../security/session.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DB_ROLE_LABEL, ROLE_OPTIONS, roleFromString } from '../users/roles.util';
import type { CreateUserDto } from './dto/create-user.dto';

/**
 * Gestão de utilizadores reservada a administradores. O controlo de acesso é
 * feito ao nível do service (`assertAdmin`), seguindo o padrão de `UsersService`.
 */
@Injectable()
export class AdminService {
  private readonly prisma: PrismaService;
  private readonly authService: AuthService;
  private readonly securityService: SecurityService;
  private readonly sessionService: SessionService;
  private readonly auditService: AuditService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(AuthService) authService: AuthService,
    @Inject(SecurityService) securityService: SecurityService,
    @Inject(SessionService) sessionService: SessionService,
    @Inject(AuditService) auditService: AuditService,
  ) {
    this.prisma = prisma;
    this.authService = authService;
    this.securityService = securityService;
    this.sessionService = sessionService;
    this.auditService = auditService;
  }

  /** Papéis válidos para os selects do frontend (derivados do enum). */
  listRoles(): ListRolesResponse {
    return { roles: ROLE_OPTIONS };
  }

  async createUser(
    caller: AuthenticatedUser,
    ip: string,
    dto: CreateUserDto,
  ): Promise<RegisterResponse> {
    this.assertAdmin(caller.role);
    const created = await this.authService.adminCreateUser(dto);
    await this.audit(
      caller,
      ip,
      'create',
      `Criou o utilizador ${created.email} com o papel ${dto.role}.`,
    );
    return created;
  }

  async updateRole(
    caller: AuthenticatedUser,
    ip: string,
    id: string,
    roleValue: string,
  ): Promise<{ id: string; role: string }> {
    this.assertAdmin(caller.role);
    const role = roleFromString(roleValue);
    if (!role) {
      throw new BadRequestException('Papel inválido.');
    }
    if (id === caller.userId) {
      throw new ForbiddenException('Não pode alterar o seu próprio papel.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado.');
    }

    await this.prisma.user.update({ where: { id }, data: { role } });
    await this.audit(
      caller,
      ip,
      'update',
      `Alterou o papel de ${user.email} para ${roleValue}.`,
    );
    return { id, role: DB_ROLE_LABEL[role] };
  }

  async deactivate(
    caller: AuthenticatedUser,
    ip: string,
    id: string,
  ): Promise<{ id: string; ativo: boolean }> {
    this.assertAdmin(caller.role);
    if (id === caller.userId) {
      throw new ForbiddenException('Não pode desativar a sua própria conta.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, eliminadoEm: true },
    });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado.');
    }

    if (!user.eliminadoEm) {
      // Soft delete anonimizado: nunca removemos a linha (mantém o histórico
      // operacional — reports/recolhas/partilhas — ligado ao user), mas
      // limpamos a PII e libertamos o email. Sem libertar o email original (que
      // é `@unique`) a pessoa nunca conseguiria voltar a registar-se com ele.
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id },
          data: {
            email: `anon_${id}@anon.invalid`,
            passwordHash: '__anonymized__',
            phone: null,
            emailVerified: false,
            twoFactorEnabled: false,
            twoFactorType: 'NONE',
            twoFactorSecret: null,
            backupCodes: [],
            eliminadoEm: new Date(),
          },
        }),
        // updateMany: users não-CIDADAO não têm perfil.
        this.prisma.cidadaoPerfil.updateMany({
          where: { userId: id },
          data: {
            nomeCompleto: null,
            notificacaoPrefs: Prisma.DbNull,
            dashboardWidgets: Prisma.DbNull,
            gamificationOptIn: false,
          },
        }),
        // `autorNome` é nome denormalizado (PII copiada) nas partilhas do user.
        this.prisma.partilha.updateMany({
          where: { userId: id },
          data: { autorNome: 'Utilizador anónimo' },
        }),
      ]);
      // Revoga acesso imediatamente: o JwtAuthGuard só bloqueia via chave de
      // revogação no Redis, por isso o soft-delete por si só não chega.
      await this.securityService.revokeUser(id);
      await this.sessionService.revokeAll(id);
      // Auditoria refere o id (não o email) para não reintroduzir PII no log.
      await this.audit(caller, ip, 'delete', `Eliminou (anonimizou) o utilizador ${id}.`);
    }
    return { id, ativo: false };
  }

  async reactivate(
    caller: AuthenticatedUser,
    ip: string,
    id: string,
  ): Promise<{ id: string; ativo: boolean }> {
    this.assertAdmin(caller.role);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, eliminadoEm: true },
    });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado.');
    }

    if (user.eliminadoEm) {
      await this.prisma.user.update({
        where: { id },
        data: { eliminadoEm: null },
      });
      await this.securityService.clearRevocation(id);
      await this.audit(caller, ip, 'update', `Reativou o utilizador ${user.email}.`);
    }
    return { id, ativo: true };
  }

  private assertAdmin(role: ContractRole): void {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Apenas administradores podem gerir utilizadores.');
    }
  }

  private async audit(
    caller: AuthenticatedUser,
    ip: string,
    acao: 'create' | 'update' | 'delete',
    descricao: string,
  ): Promise<void> {
    try {
      const admin = await this.prisma.user.findUnique({
        where: { id: caller.userId },
        select: { email: true },
      });
      await this.auditService.write({
        utilizador: admin?.email ?? caller.userId,
        papel: 'admin',
        acao,
        descricao,
        ip,
      });
    } catch {
      // Auditoria é best-effort — nunca deve impedir a ação principal.
    }
  }
}
