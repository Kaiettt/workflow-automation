import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository';

@Injectable()
export class SessionRevocationWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: RefreshTokenRepository,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.flush();
    }, 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.prisma.sessionRevocation.findMany({
        where: { completedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const event of events) {
        await this.tokens.revokeBefore(event.userId, event.sessionVersion);
        await this.prisma.sessionRevocation.update({
          where: { id: event.id },
          data: { completedAt: new Date() },
        });
      }
    } catch {
      /* The persisted outbox is retried on the next tick. DB version already denies old tokens. */
    } finally {
      this.running = false;
    }
  }
}
