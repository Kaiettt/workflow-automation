import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { ExecutionController } from './presentation/http/execution.controller';
import { StartExecutionHandler } from './application/commands/start-execution.handler';
import { ExecutionRepository } from './domain/repositories/execution.repository';
import { PrismaExecutionRepository } from './infrastructure/persistence/prisma-execution.repository';
import { ManualTriggerExecutor } from './domain/entities/manual-trigger-executor';
import { GoogleSheetReadRowsExecutor } from './domain/entities/google-sheet-read-rows-executor';
import { FilterExecutor } from './domain/entities/filter-executor';
import { GmailSendExecutor } from './domain/entities/gmail-send-executor';
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
      ): INodeExecutor[] => [
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
