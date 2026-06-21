import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
