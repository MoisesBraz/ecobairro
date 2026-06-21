import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { readNumberEnv, requireEnv } from '@ecobairro/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { MailModule } from '../mail/mail.module';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MailModule,
    forwardRef(() => AuditModule),
    forwardRef(() => SecurityModule),
    JwtModule.register({
      secret: requireEnv('JWT_ACCESS_SECRET'),
      signOptions: {
        expiresIn: `${readNumberEnv('JWT_ACCESS_TTL_MINUTES', 15)}m`,
      },
    }),
  ],
  controllers: [AuthController, TwoFactorController],
  providers: [AuthService, TwoFactorService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, TwoFactorService, JwtAuthGuard, OptionalJwtAuthGuard, JwtModule, SecurityModule],
})
export class AuthModule {}
