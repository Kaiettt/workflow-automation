import { Workflow as PrismaWorkflow } from '@prisma/client';
import { Workflow } from '../../../domain/entities/workflow.entity';
import { WorkflowStatus } from '../../../domain/enums/workflow-status.enum';

export class WorkflowMapper {
  static toDomain(prismaWorkflow: PrismaWorkflow): Workflow {
    return new Workflow(
      prismaWorkflow.id,
      prismaWorkflow.name,
      prismaWorkflow.ownerId,
      prismaWorkflow.status as WorkflowStatus,
      prismaWorkflow.description,
      prismaWorkflow.currentVersionId,
      prismaWorkflow.createdAt,
      prismaWorkflow.updatedAt,
    );
  }
}
