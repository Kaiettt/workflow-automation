import { createHash } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  ChatMemoryPort,
  ChatMessage,
} from '../../application/ports/chat-memory.port';

// One Redis list per workflow and session. The session key (a customer id) is
// hashed, so it never shows up in Redis; the prefix keeps e2e runs and dev
// servers that share a Redis apart, like BULLMQ_PREFIX does for the queue.
@Injectable()
export class RedisChatMemory implements ChatMemoryPort, OnModuleDestroy {
  private readonly redis = new Redis({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  private key(workflowId: string, sessionKey: string): string {
    const prefix = process.env['BULLMQ_PREFIX'] || 'flowpilot';
    const session = createHash('sha256').update(sessionKey).digest('hex');
    return `${prefix}:chatmem:${workflowId}:${session}`;
  }

  async load(
    workflowId: string,
    sessionKey: string,
    limit: number,
  ): Promise<ChatMessage[]> {
    const rows = await this.redis.lrange(
      this.key(workflowId, sessionKey),
      -limit,
      -1,
    );
    return rows.flatMap((row) => {
      try {
        const message = JSON.parse(row) as Partial<ChatMessage>;
        return (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
          ? [{ role: message.role, content: message.content }]
          : [];
      } catch {
        return [];
      }
    });
  }

  async append(
    workflowId: string,
    sessionKey: string,
    messages: ChatMessage[],
    options: { maxMessages: number; ttlSeconds: number },
  ): Promise<void> {
    if (messages.length === 0) return;
    const key = this.key(workflowId, sessionKey);
    await this.redis
      .multi()
      .rpush(key, ...messages.map((message) => JSON.stringify(message)))
      .ltrim(key, -options.maxMessages, -1)
      .expire(key, options.ttlSeconds)
      .exec();
  }

  async clear(workflowId: string, sessionKey: string): Promise<void> {
    await this.redis.del(this.key(workflowId, sessionKey));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
