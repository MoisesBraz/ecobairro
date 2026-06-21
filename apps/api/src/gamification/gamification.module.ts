import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { QuizAdminController } from './quiz-admin.controller';
import { QuizAdminService } from './quiz-admin.service';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, RedisModule],
  controllers: [GamificationController, QuizAdminController],
  providers: [GamificationService, QuizAdminService],
})
export class GamificationModule {}

