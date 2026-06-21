import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CampanhasController } from './campanhas.controller';
import { CampanhasService } from './campanhas.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CampanhasController],
  providers: [CampanhasService],
})
export class CampanhasModule {}
