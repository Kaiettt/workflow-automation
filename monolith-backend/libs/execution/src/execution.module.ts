import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { ExecutionController } from './presentation/http/execution.controller';
import { StartExecutionHandler } from './application/commands/start-execution/start-execution.handler';
import { ExecutionRepository } from './domain/repositories/execution.repository';
import { PrismaExecutionRepository } from './infrastructure/persistence/prisma-execution.repository';
import { ManualTriggerExecutor } from './application/executors/manual-trigger-executor';
import { GoogleSheetReadRowsExecutor } from './application/executors/google-sheet-read-rows-executor';
import { FilterExecutor } from './application/executors/filter-executor';
import { GmailSendExecutor } from './application/executors/gmail-send-executor';
import { INodeExecutor } from './domain/entities/node-executor';

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule],
  controllers: [ExecutionController],
  providers: [
    ManualTriggerExecutor,
    GoogleSheetReadRowsExecutor,
    FilterExecutor,
    GmailSendExecutor,
    { provide: ExecutionRepository, useClass: PrismaExecutionRepository },
    {
      provide: 'NODE_EXECUTORS',
      useFactory: (
        manualTriggerExecutor: ManualTriggerExecutor,
        googleSheetReadRowsExecutor: GoogleSheetReadRowsExecutor,
        filterExecutor: FilterExecutor,
        gmailSendExecutor: GmailSendExecutor,
      ): INodeExecutor<unknown, unknown, unknown>[] => [
        manualTriggerExecutor,
        googleSheetReadRowsExecutor,
        filterExecutor,
        gmailSendExecutor,
      ],
      inject: [
        ManualTriggerExecutor,
        GoogleSheetReadRowsExecutor,
        FilterExecutor,
        GmailSendExecutor,
      ],
    },
    StartExecutionHandler,
  ],
})
export class ExecutionModule {}
