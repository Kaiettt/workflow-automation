import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { ExecutionController } from './presentation/http/execution.controller';
import { StartExecutionHandler } from './application/commands/start-execution/start-execution.command';
import { EnqueueExecutionHandler } from './application/commands/enqueue-execution/enqueue-execution.command';
import { WorkflowEngine } from './application/services/workflow-engine';
import { ExecutionQueuePort } from './application/ports/execution-queue.port';
import {
  BullMqExecutionQueue,
  executionQueueImports,
} from './infrastructure/queue/execution-queue.module';
import { ExecutionProcessor } from './infrastructure/queue/execution.processor';
import { ExecutionRepository } from './domain/repositories/execution.repository';
import { PrismaExecutionRepository } from './infrastructure/persistence/prisma-execution.repository';
import { NodeCatalogPort } from './application/ports/node-catalog.port';
import { NodeCatalogAdapter } from './infrastructure/adapters/node-catalog.adapter';
import { LlmProvider } from './application/ports/llm-provider.port';
import { LlmProviderRegistry } from './application/services/llm-provider.registry';
import { AnthropicLlmAdapter } from './infrastructure/llm/anthropic-llm.adapter';
import { OpenAiLlmAdapter } from './infrastructure/llm/openai-llm.adapter';
import { GeminiLlmAdapter } from './infrastructure/llm/gemini-llm.adapter';
import { ManualTriggerExecutor } from './application/executors/manual-trigger-executor';
import { PassThroughTriggerExecutor } from './application/executors/pass-through-trigger-executor';
import { MessengerSendExecutor } from './application/executors/messenger-send-executor';
import { MessengerClient } from './application/ports/messenger-client.port';
import { GraphMessengerClient } from './infrastructure/messenger/graph-messenger.client';
import { NodeKeys } from './domain/constants/execution.constants';

// Overridable in tests so nothing is sent to Facebook.
export const MESSENGER_CLIENT = 'MESSENGER_CLIENT';
import { GoogleSheetReadRowsExecutor } from './application/executors/google-sheet-read-rows-executor';
import { FilterExecutor } from './application/executors/filter-executor';
import { GmailSendExecutor } from './application/executors/gmail-send-executor';
import { AggregateExecutor } from './application/executors/aggregate-executor';
import {
  LlmGenerateExecutor,
  parseMaxItemsCeiling,
} from './application/executors/llm-generate-executor';
import { INodeExecutor } from './domain/entities/node-executor';

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule, ...executionQueueImports],
  controllers: [ExecutionController],
  providers: [
    ManualTriggerExecutor,
    GoogleSheetReadRowsExecutor,
    FilterExecutor,
    GmailSendExecutor,
    AggregateExecutor,
    AnthropicLlmAdapter,
    OpenAiLlmAdapter,
    GeminiLlmAdapter,
    {
      provide: 'LLM_PROVIDERS',
      useFactory: (
        anthropic: AnthropicLlmAdapter,
        openai: OpenAiLlmAdapter,
        gemini: GeminiLlmAdapter,
      ): LlmProvider[] => [anthropic, openai, gemini],
      inject: [AnthropicLlmAdapter, OpenAiLlmAdapter, GeminiLlmAdapter],
    },
    {
      provide: LlmProviderRegistry,
      useFactory: (providers: LlmProvider[]) =>
        new LlmProviderRegistry(providers),
      inject: ['LLM_PROVIDERS'],
    },
    {
      provide: LlmGenerateExecutor,
      useFactory: (registry: LlmProviderRegistry) =>
        new LlmGenerateExecutor(
          registry,
          parseMaxItemsCeiling(process.env['LLM_MAX_ITEMS']),
        ),
      inject: [LlmProviderRegistry],
    },
    { provide: MESSENGER_CLIENT, useClass: GraphMessengerClient },
    {
      provide: MessengerSendExecutor,
      useFactory: (client: MessengerClient) =>
        new MessengerSendExecutor(client),
      inject: [MESSENGER_CLIENT],
    },
    { provide: ExecutionRepository, useClass: PrismaExecutionRepository },
    { provide: NodeCatalogPort, useClass: NodeCatalogAdapter },
    {
      provide: 'NODE_EXECUTORS',
      useFactory: (
        manualTriggerExecutor: ManualTriggerExecutor,
        googleSheetReadRowsExecutor: GoogleSheetReadRowsExecutor,
        filterExecutor: FilterExecutor,
        gmailSendExecutor: GmailSendExecutor,
        aggregateExecutor: AggregateExecutor,
        llmGenerateExecutor: LlmGenerateExecutor,
        messengerSendExecutor: MessengerSendExecutor,
      ): INodeExecutor[] => [
        manualTriggerExecutor,
        new PassThroughTriggerExecutor(NodeKeys.TRIGGER_WEBHOOK),
        new PassThroughTriggerExecutor(NodeKeys.TRIGGER_MESSENGER_MESSAGE),
        googleSheetReadRowsExecutor,
        filterExecutor,
        gmailSendExecutor,
        aggregateExecutor,
        llmGenerateExecutor,
        messengerSendExecutor,
      ],
      inject: [
        ManualTriggerExecutor,
        GoogleSheetReadRowsExecutor,
        FilterExecutor,
        GmailSendExecutor,
        AggregateExecutor,
        LlmGenerateExecutor,
        MessengerSendExecutor,
      ],
    },
    {
      provide: WorkflowEngine,
      useFactory: (
        repository: ExecutionRepository,
        executors: INodeExecutor[],
        catalog: NodeCatalogPort,
      ) => new WorkflowEngine(repository, executors, catalog),
      inject: [ExecutionRepository, 'NODE_EXECUTORS', NodeCatalogPort],
    },
    { provide: ExecutionQueuePort, useClass: BullMqExecutionQueue },
    ExecutionProcessor,
    StartExecutionHandler,
    EnqueueExecutionHandler,
  ],
})
export class ExecutionModule {}
