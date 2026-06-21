import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { requireEnv } from '@ecobairro/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client = new Redis(requireEnv('REDIS_URL'), {
    maxRetriesPerRequest: 1,
  });

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
