import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  OtpRepository,
  OtpRecord,
} from '../../domain/repositories/otp.repository';
import { OtpType } from '../../domain/enums/otp-type.enum';

@Injectable()
export class RedisOtpRepository implements OtpRepository, OnModuleDestroy {
  private readonly logger = new Logger(RedisOtpRepository.name);
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
          `Connected to Redis at ${host}:${port} for OTP storage`,
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

  private getKey(email: string, type: OtpType): string {
    return `otp:${type.toLowerCase()}:${email.toLowerCase().trim()}`;
  }

  async create(
    email: string,
    code: string,
    type: OtpType,
    expiresAt: Date,
  ): Promise<OtpRecord> {
    const key = this.getKey(email, type);
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    // Store in Redis with TTL in seconds
    await this.redis.set(key, code, 'EX', ttlSeconds);

    return {
      id: key,
      email: email.toLowerCase().trim(),
      code,
      type,
      isUsed: false,
      expiresAt,
      createdAt: new Date(),
    };
  }

  async findLatestValid(
    email: string,
    code: string,
    type: OtpType,
  ): Promise<OtpRecord | null> {
    const key = this.getKey(email, type);
    const storedCode = await this.redis.get(key);

    if (!storedCode || storedCode !== code.trim()) {
      return null;
    }

    const ttl = await this.redis.ttl(key);
    const expiresAt = new Date(Date.now() + Math.max(0, ttl) * 1000);

    return {
      id: key,
      email: email.toLowerCase().trim(),
      code: storedCode,
      type,
      isUsed: false,
      expiresAt,
      createdAt: new Date(),
    };
  }

  async markAsUsed(id: string): Promise<void> {
    // In Redis, deleting the key ensures it can never be used again and frees memory immediately
    await this.redis.del(id);
  }

  private getVerifiedKey(email: string, type: OtpType): string {
    return `otp:verified:${type.toLowerCase()}:${email.toLowerCase().trim()}`;
  }

  async markAsVerified(
    email: string,
    type: OtpType,
    ttlSeconds = 900,
  ): Promise<void> {
    const key = this.getVerifiedKey(email, type);
    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }

  async isVerified(email: string, type: OtpType): Promise<boolean> {
    const key = this.getVerifiedKey(email, type);
    const exists = await this.redis.get(key);
    return exists === '1';
  }

  async consumeVerified(email: string, type: OtpType): Promise<void> {
    const key = this.getVerifiedKey(email, type);
    await this.redis.del(key);
  }
}
