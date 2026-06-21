import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CidadaosController } from './cidadaos.controller';
import { CidadaosService } from './cidadaos.service';

@Module({
  imports: [AuthModule],
  controllers: [CidadaosController],
  providers: [CidadaosService],
})
export class CidadaosModule {}
