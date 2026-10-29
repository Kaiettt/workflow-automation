import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { WebhookDedupPort } from '../application/ports/webhook-dedup.port';

@Injectable()
export class RedisWebhookDedup implements WebhookDedupPort, OnModuleDestroy {
  private readonly redis = new Redis({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
