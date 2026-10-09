import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@app/auth';
import { WorkflowDraftsController } from './presentation/http/workflow-drafts.controller';
import { WorkflowsController } from './presentation/http/workflows.controller';
import { SaveDraftHandler } from './application/commands/save-draft.command';
import { CreateWorkflowHandler } from './application/commands/create-workflow.command';
import { GetWorkflowDraftHandler } from './application/queries/get-workflow-draft.query';
import { PrismaWorkflowRepository } from './infrastructure/persistence/prisma-workflow.repository';
import { PrismaWorkflowDraftRepository } from './infrastructure/persistence/prisma-workflow-draft.repository';
import { WorkflowRepository } from './domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from './domain/repositories/workflow-draft.repository';

import { PublishWorkflowHandler } from './application/commands/publish-workflow.command';
import { RestoreVersionHandler } from './application/commands/restore-version.command';
import { GetDraftStatusHandler } from './application/queries/get-draft-status.query';
import { WorkflowVersionRepository } from './domain/repositories/workflow-version.repository';
import { PrismaWorkflowVersionRepository } from './infrastructure/persistence/prisma-workflow-version.repository';

const CommandHandlers = [
  SaveDraftHandler,
  CreateWorkflowHandler,
  PublishWorkflowHandler,
  RestoreVersionHandler,
];
const QueryHandlers = [GetWorkflowDraftHandler, GetDraftStatusHandler];
const Repositories = [
  {
    provide: WorkflowRepository,
    useClass: PrismaWorkflowRepository,
  },
  {
    provide: WorkflowDraftRepository,
    useClass: PrismaWorkflowDraftRepository,
  },
  {
    provide: WorkflowVersionRepository,
    useClass: PrismaWorkflowVersionRepository,
  },
];

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [WorkflowDraftsController, WorkflowsController],
  providers: [...CommandHandlers, ...QueryHandlers, ...Repositories],
})
export class DesignerModule {}
