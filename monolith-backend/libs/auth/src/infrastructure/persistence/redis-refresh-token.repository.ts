import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';

@Injectable()
export class RedisRefreshTokenRepository
  implements RefreshTokenRepository, OnModuleDestroy
{
  private readonly logger = new Logger(RedisRefreshTokenRepository.name);
  private readonly redis: Redis;

  constructor() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.redis = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redis
      .connect()
      .then(() => {
        this.logger.log(
          `Connected to Redis at ${host}:${port} for Refresh Token storage`,
        );
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to connect to Redis at ${host}:${port}: ${msg}`,
        );
      });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private getKey(userId: string): string {
    return `refresh_token:${userId}`;
  }

  async save(userId: string, token: string, ttlSeconds: number): Promise<void> {
    const key = this.getKey(userId);
    await this.redis.set(key, token, 'EX', ttlSeconds);
  }

  async validate(userId: string, token: string): Promise<boolean> {
    const key = this.getKey(userId);
    const storedToken = await this.redis.get(key);
    return storedToken === token;
  }

  async revoke(userId: string): Promise<void> {
    const key = this.getKey(userId);
    await this.redis.del(key);
  }
}
