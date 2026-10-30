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
import { packageExecutors } from './application/executors/package-action-executor';
import { AppsModule, PackageRegistry } from '@app/apps';
import { GoogleSheetReadRowsExecutor } from './application/executors/google-sheet-read-rows-executor';
import { FilterExecutor } from './application/executors/filter-executor';
import { IfExecutor } from './application/executors/if-executor';
import { SwitchExecutor } from './application/executors/switch-executor';
import { SetFieldsExecutor } from './application/executors/set-fields-executor';
import { GmailSendExecutor } from './application/executors/gmail-send-executor';
import { AggregateExecutor } from './application/executors/aggregate-executor';
import {
  LlmGenerateExecutor,
  parseMaxItemsCeiling,
} from './application/executors/llm-generate-executor';
import { INodeExecutor } from './domain/entities/node-executor';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    AuthModule,
    AppsModule,
    ...executionQueueImports,
  ],
  controllers: [ExecutionController],
  providers: [
    ManualTriggerExecutor,
    GoogleSheetReadRowsExecutor,
    FilterExecutor,
    IfExecutor,
    SwitchExecutor,
    SetFieldsExecutor,
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
    { provide: ExecutionRepository, useClass: PrismaExecutionRepository },
    { provide: NodeCatalogPort, useClass: NodeCatalogAdapter },
    {
      provide: 'NODE_EXECUTORS',
      useFactory: (
        manualTriggerExecutor: ManualTriggerExecutor,
        googleSheetReadRowsExecutor: GoogleSheetReadRowsExecutor,
        filterExecutor: FilterExecutor,
        ifExecutor: IfExecutor,
        switchExecutor: SwitchExecutor,
        setFieldsExecutor: SetFieldsExecutor,
        gmailSendExecutor: GmailSendExecutor,
        aggregateExecutor: AggregateExecutor,
        llmGenerateExecutor: LlmGenerateExecutor,
        packages: PackageRegistry,
      ): INodeExecutor[] => [
        manualTriggerExecutor,
        googleSheetReadRowsExecutor,
        filterExecutor,
        ifExecutor,
        switchExecutor,
        setFieldsExecutor,
        gmailSendExecutor,
        aggregateExecutor,
        llmGenerateExecutor,
        // Nodes of integration packages (webhook, messenger…).
        ...packageExecutors(packages),
      ],
      inject: [
        ManualTriggerExecutor,
        GoogleSheetReadRowsExecutor,
        FilterExecutor,
        IfExecutor,
        SwitchExecutor,
        SetFieldsExecutor,
        GmailSendExecutor,
        AggregateExecutor,
        LlmGenerateExecutor,
        PackageRegistry,
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
