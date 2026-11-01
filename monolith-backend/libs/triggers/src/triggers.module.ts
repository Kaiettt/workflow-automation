import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { AppsModule } from '@app/apps';
import { ConnectorModule } from '@app/connector';
import { WebhooksController } from './presentation/http/webhooks.controller';
import {
  TestEventsController,
  WorkflowActivationController,
} from './presentation/http/workflow-activation.controller';
import { ReceiveWebhookHandler } from './application/commands/receive-webhook.command';
import { SwitchActiveVersionHandler } from './application/commands/switch-active-version.handler';
import { CheckPublishTriggersHandler } from './application/queries/check-publish-triggers.handler';
import { ActivationService } from './application/activation.service';
import { EndpointRegistrar } from './application/endpoint-registrar';
import { TestListenService } from './application/test-listen.service';
import { WebhookDedupPort } from './application/ports/webhook-dedup.port';
import { TestEventStore } from './application/ports/test-event.store';
import { TriggerRepository } from './domain/trigger.repository';
import { PrismaTriggerRepository } from './infrastructure/prisma-trigger.repository';
import { RedisWebhookDedup } from './infrastructure/redis-webhook-dedup';
import { RedisTestEventStore } from './infrastructure/redis-test-event.store';

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule, AppsModule, ConnectorModule],
  controllers: [
    WebhooksController,
    WorkflowActivationController,
    TestEventsController,
  ],
  providers: [
    ActivationService,
    EndpointRegistrar,
    TestListenService,
    ReceiveWebhookHandler,
    SwitchActiveVersionHandler,
    CheckPublishTriggersHandler,
    { provide: TriggerRepository, useClass: PrismaTriggerRepository },
    { provide: WebhookDedupPort, useClass: RedisWebhookDedup },
    { provide: TestEventStore, useClass: RedisTestEventStore },
  ],
})
export class TriggersModule {}
