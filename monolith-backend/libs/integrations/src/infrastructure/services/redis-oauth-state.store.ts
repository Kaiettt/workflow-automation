import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { OauthStateStore } from '../../application/ports/oauth-state.store';

@Injectable()
export class RedisOauthStateStore implements OauthStateStore, OnModuleDestroy {
  private readonly redis = new Redis({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  async save(state: string, value: string, ttlSeconds: number) {
    await this.redis.set(`oauth:state:${state}`, value, 'EX', ttlSeconds);
  }

  async take(state: string) {
    return this.redis.getdel(`oauth:state:${state}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
