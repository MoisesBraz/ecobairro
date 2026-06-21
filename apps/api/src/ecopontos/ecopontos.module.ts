import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EcopontosController } from './ecopontos.controller';
import { EcopontosService } from './ecopontos.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [EcopontosController],
  providers: [EcopontosService],
})
export class EcopontosModule {}
