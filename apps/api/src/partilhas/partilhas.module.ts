import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PartilhasController } from './partilhas.controller';
import { PartilhasService } from './partilhas.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PartilhasController],
  providers: [PartilhasService],
})
export class PartilhasModule {}
