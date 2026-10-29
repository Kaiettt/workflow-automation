import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { WebhooksController } from './presentation/http/webhooks.controller';
import { WorkflowTriggersController } from './presentation/http/workflow-triggers.controller';
import { SyncWorkflowTriggersHandler } from './application/events/sync-workflow-triggers.handler';
import { ReceiveWebhookHandler } from './application/commands/receive-webhook.command';
import { GetWorkflowTriggersHandler } from './application/queries/get-workflow-triggers.query';
import { WebhookDedupPort } from './application/ports/webhook-dedup.port';
import { WorkflowTriggerRepository } from './domain/workflow-trigger.repository';
import { PrismaWorkflowTriggerRepository } from './infrastructure/prisma-workflow-trigger.repository';
import { RedisWebhookDedup } from './infrastructure/redis-webhook-dedup';

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule],
  controllers: [WebhooksController, WorkflowTriggersController],
  providers: [
    SyncWorkflowTriggersHandler,
    ReceiveWebhookHandler,
    GetWorkflowTriggersHandler,
    {
      provide: WorkflowTriggerRepository,
      useClass: PrismaWorkflowTriggerRepository,
    },
    { provide: WebhookDedupPort, useClass: RedisWebhookDedup },
  ],
})
export class TriggersModule {}
