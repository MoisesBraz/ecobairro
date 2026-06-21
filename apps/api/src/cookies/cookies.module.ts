import { Module } from '@nestjs/common';
import { CookiesService } from './cookies.service';
import { CookiesController } from './cookies.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CookiesController],
  providers: [CookiesService],
})
export class CookiesModule {}
