import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WorkflowDraftsController } from './presentation/http/workflow-drafts.controller';
import { WorkflowsController } from './presentation/http/workflows.controller';
import { SaveDraftHandler } from './application/commands/save-draft.handler';
import { CreateWorkflowHandler } from './application/commands/create-workflow.handler';
import { GetWorkflowDraftHandler } from './application/queries/get-workflow-draft.handler';
import { PrismaWorkflowRepository } from './infrastructure/persistence/prisma-workflow.repository';
import { PrismaWorkflowDraftRepository } from './infrastructure/persistence/prisma-workflow-draft.repository';
import { WorkflowRepository } from './domain/repositories/workflow.repository';
import { WorkflowDraftRepository } from './domain/repositories/workflow-draft.repository';

const CommandHandlers = [SaveDraftHandler, CreateWorkflowHandler];
const QueryHandlers = [GetWorkflowDraftHandler];
const Repositories = [
  {
    provide: WorkflowRepository,
    useClass: PrismaWorkflowRepository,
  },
  {
    provide: WorkflowDraftRepository,
    useClass: PrismaWorkflowDraftRepository,
  },
];

@Module({
  imports: [CqrsModule],
  controllers: [WorkflowDraftsController, WorkflowsController],
  providers: [...CommandHandlers, ...QueryHandlers, ...Repositories],
})
export class DesignerModule {}
