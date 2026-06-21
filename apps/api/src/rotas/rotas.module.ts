import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RotasController } from './rotas.controller';
import { RotasService } from './rotas.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RotasController],
  providers: [RotasService],
})
export class RotasModule {}
