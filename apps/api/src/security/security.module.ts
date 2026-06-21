import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { SecurityService } from './security.service';
import { SessionService } from './session.service';
import { SecurityController } from './security.controller';

@Module({
  imports: [DatabaseModule, RedisModule, forwardRef(() => AuthModule)],
  controllers: [SecurityController],
  providers: [SecurityService, SessionService],
  exports: [SecurityService, SessionService],
})
export class SecurityModule {}
