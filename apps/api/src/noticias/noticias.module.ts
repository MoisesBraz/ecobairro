import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NoticiasController } from './noticias.controller';
import { NoticiasService } from './noticias.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NoticiasController],
  providers: [NoticiasService],
})
export class NoticiasModule {}
