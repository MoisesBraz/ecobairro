import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  // AuthModule reexporta SecurityModule, logo dá acesso a AuthService,
  // SecurityService, SessionService e JwtAuthGuard.
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
