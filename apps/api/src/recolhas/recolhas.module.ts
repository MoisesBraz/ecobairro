import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RecolhasController } from './recolhas.controller';
import { RecolhasService } from './recolhas.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RecolhasController],
  providers: [RecolhasService],
})
export class RecolhasModule {}
