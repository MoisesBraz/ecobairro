import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCookieLogDto } from './dto/create-cookie-log.dto';

@Injectable()
export class CookiesService {
  constructor(private db: PrismaService) {}

  async createLog(createLogDto: CreateCookieLogDto, ipHash?: string) {
    return this.db.cookieConsentLog.create({
      data: {
        deviceId: createLogDto.deviceId,
        userId: createLogDto.userId,
        analytics: createLogDto.analytics,
        marketing: createLogDto.marketing,
        preferences: createLogDto.preferences,
        ipHash: ipHash,
      },
    });
  }
}
