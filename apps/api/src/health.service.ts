import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Client } from 'pg';
import { requireEnv } from '@ecobairro/config';
import type { DependencyHealth } from '@ecobairro/contracts';

@Injectable()
export class HealthService {
  async checkDependencies(): Promise<DependencyHealth[]> {
    return Promise.all([this.checkPostgres(), this.checkRedis()]);
  }

  private async checkPostgres(): Promise<DependencyHealth> {
    let databaseUrl: string;

    try {
      databaseUrl = requireEnv('DATABASE_URL');
    } catch (error) {
      return {
        name: 'postgres',
        status: 'down',
        details: formatError(error),
      };
    }

    const client = new Client({
      connectionString: databaseUrl,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');

      return {
        name: 'postgres',
        status: 'up',
      };
    } catch (error) {
      return {
        name: 'postgres',
        status: 'down',
        details: formatError(error),
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    let redisUrl: string;

    try {
      redisUrl = requireEnv('REDIS_URL');
    } catch (error) {
      return {
        name: 'redis',
        status: 'down',
        details: formatError(error),
      };
    }

    const redis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();

      return {
        name: 'redis',
        status: pong === 'PONG' ? 'up' : 'down',
        details: pong === 'PONG' ? undefined : `Unexpected response: ${pong}`,
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'down',
        details: formatError(error),
      };
    } finally {
      redis.disconnect();
    }
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

