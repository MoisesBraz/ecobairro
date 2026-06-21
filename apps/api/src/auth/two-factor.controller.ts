import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { badRequest, unauthorized } from '../common/errors';
import bcrypt from 'bcrypt';
import type {
  EnableTwoFactorResponse,
  RegenerateBackupCodesResponse,
  RevealBackupCodesResponse,
  SetupTwoFactorResponse,
  TwoFactorStatusResponse,
} from '@ecobairro/contracts';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';
import { EnableTwoFactorDto } from './dto/enable-two-factor.dto';
import { PasswordConfirmDto } from './dto/password-confirm.dto';
import { PrismaService } from '../database/prisma.service';
import { SecurityService } from '../security/security.service';
import { SecurityEventType } from '@prisma/client';

@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  private readonly twoFactor: TwoFactorService;
  private readonly prisma: PrismaService;
  private readonly security: SecurityService;

  constructor(
    @Inject(TwoFactorService) twoFactor: TwoFactorService,
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(SecurityService) security: SecurityService,
  ) {
    this.twoFactor = twoFactor;
    this.prisma = prisma;
    this.security = security;
  }

  @Get('status')
  async status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorStatusResponse> {
    const u = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { twoFactorEnabled: true, twoFactorType: true, backupCodes: true },
    });
    return {
      enabled: !!u?.twoFactorEnabled,
      type: (u?.twoFactorType ?? 'NONE') as TwoFactorStatusResponse['type'],
      backup_codes_remaining: u?.backupCodes.length ?? 0,
    };
  }

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setup(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SetupTwoFactorResponse> {
    const u = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!u) throw unauthorized();
    if (u.twoFactorEnabled) {
      throw badRequest('AUTH_2FA_ALREADY_ENABLED');
    }

    const { secret, otpauthUrl, qrCodeDataUrl } =
      await this.twoFactor.generateSetup(user.userId, u.email);

    return {
      secret,
      otpauth_url: otpauthUrl,
      qr_code_data_url: qrCodeDataUrl,
    };
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  async enable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: EnableTwoFactorDto,
  ): Promise<EnableTwoFactorResponse> {
    const result = await this.twoFactor.enable(user.userId, body.code);
    if (!result) {
      throw new BadRequestException(
        'Código inválido ou sessão de configuração expirada.',
      );
    }
    await this.security
      .log(user.userId, SecurityEventType.TWO_FACTOR_ENABLED, {
        ipAddress: '2fa-flow',
        userAgent: null,
      })
      .catch(() => undefined);
    return { enabled: true, backup_codes: result.backupCodes };
  }

  @Post('email/setup')
  @HttpCode(HttpStatus.OK)
  async setupEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ sent: true }> {
    const u = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!u) throw unauthorized();
    if (u.twoFactorEnabled) {
      throw badRequest('AUTH_2FA_ALREADY_ENABLED');
    }
    await this.twoFactor.sendEmailCode(user.userId, u.email);
    return { sent: true };
  }

  @Post('email/enable')
  @HttpCode(HttpStatus.OK)
  async enableEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: EnableTwoFactorDto,
  ): Promise<EnableTwoFactorResponse> {
    const result = await this.twoFactor.enableEmail(user.userId, body.code);
    if (!result) {
      throw new BadRequestException('Código inválido ou expirado.');
    }
    await this.security
      .log(user.userId, SecurityEventType.TWO_FACTOR_ENABLED, {
        ipAddress: '2fa-flow',
        userAgent: null,
      })
      .catch(() => undefined);
    return { enabled: true, backup_codes: result.backupCodes };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PasswordConfirmDto,
  ): Promise<{ disabled: true }> {
    await this.requirePassword(user.userId, body.password);
    await this.twoFactor.disable(user.userId);
    await this.security
      .log(user.userId, SecurityEventType.TWO_FACTOR_DISABLED, {
        ipAddress: '2fa-flow',
        userAgent: null,
      })
      .catch(() => undefined);
    return { disabled: true };
  }

  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PasswordConfirmDto,
  ): Promise<RegenerateBackupCodesResponse> {
    await this.requirePassword(user.userId, body.password);
    const codes = await this.twoFactor.regenerateBackupCodes(user.userId);
    return { backup_codes: codes };
  }

  /**
   * "Revelar" os backup codes não devolve os antigos (estão hashed) —
   * regenera um conjunto novo após confirmar a password. É a única forma
   * segura de o utilizador voltar a ter codes em plaintext.
   */
  @Post('backup-codes/reveal')
  @HttpCode(HttpStatus.OK)
  async reveal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PasswordConfirmDto,
  ): Promise<RevealBackupCodesResponse> {
    await this.requirePassword(user.userId, body.password);
    const codes = await this.twoFactor.regenerateBackupCodes(user.userId);
    return { backup_codes: codes };
  }

  private async requirePassword(userId: string, password: string): Promise<void> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!u) throw unauthorized();
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) throw unauthorized('AUTH_PASSWORD_INCORRECT');
  }
}
