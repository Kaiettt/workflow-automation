import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  isExpired,
  TestEventStore,
} from '../application/ports/test-event.store';
import { TestListen } from '../domain/trigger.types';

// Kept a while after expiry so the designer can still read the outcome.
const KEEP_SECONDS = 600;

@Injectable()
export class RedisTestEventStore implements TestEventStore, OnModuleDestroy {
  private readonly redis = new Redis({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  async save(listen: TestListen): Promise<void> {
    const index = indexKey(listen.endpointId);
    await this.redis
      .multi()
      .set(key(listen.id), JSON.stringify(listen), 'EX', KEEP_SECONDS)
      .sadd(index, listen.id)
      .expire(index, KEEP_SECONDS)
      .exec();
  }

  async get(listenId: string): Promise<TestListen | null> {
    const raw = await this.redis.get(key(listenId));
    return raw ? (JSON.parse(raw) as TestListen) : null;
  }

  async waitingFor(endpointId: string): Promise<TestListen[]> {
    const ids = await this.redis.smembers(indexKey(endpointId));
    if (ids.length === 0) return [];
    const raws = await this.redis.mget(ids.map(key));
    const waiting: TestListen[] = [];
    const stale: string[] = [];
    raws.forEach((raw, index) => {
      const listen = raw ? (JSON.parse(raw) as TestListen) : null;
      if (listen && listen.status === 'waiting' && !isExpired(listen)) {
        waiting.push(listen);
      } else {
        stale.push(ids[index]);
      }
    });
    if (stale.length > 0) await this.redis.srem(indexKey(endpointId), ...stale);
    return waiting;
  }

  async remove(listenId: string): Promise<void> {
    const listen = await this.get(listenId);
    await this.redis.del(key(listenId));
    if (listen) await this.redis.srem(indexKey(listen.endpointId), listenId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

const key = (listenId: string) => `test-listen:${listenId}`;
const indexKey = (endpointId: string) => `test-listen:endpoint:${endpointId}`;
