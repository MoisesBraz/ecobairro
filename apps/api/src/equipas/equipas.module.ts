import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EquipasController } from './equipas.controller';
import { EquipasService } from './equipas.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [EquipasController],
  providers: [EquipasService],
})
export class EquipasModule {}
