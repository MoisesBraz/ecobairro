import { Controller, Post, Body, Req } from '@nestjs/common';
import { CookiesService } from './cookies.service';
import { CreateCookieLogDto } from './dto/create-cookie-log.dto';
import type { Request } from 'express';
import * as crypto from 'crypto';

@Controller('v1/cookies')
export class CookiesController {
  constructor(private readonly cookiesService: CookiesService) {}

  @Post('consent')
  async createConsentLog(@Body() createLogDto: CreateCookieLogDto, @Req() req: Request) {
    // Generate a simple hash of the IP for anonymous auditability
    const rawIp = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex').substring(0, 16);
    
    await this.cookiesService.createLog(createLogDto, ipHash);
    
    return { success: true };
  }
}
