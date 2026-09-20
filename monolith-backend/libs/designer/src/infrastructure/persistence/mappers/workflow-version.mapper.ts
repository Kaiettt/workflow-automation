import { WorkflowVersion as PrismaWorkflowVersion } from '@prisma/client';
import { WorkflowVersion } from '../../../domain/entities/workflow-version.entity';

export class WorkflowVersionMapper {
  static toDomain(prismaVersion: PrismaWorkflowVersion): WorkflowVersion {
    return new WorkflowVersion(
      prismaVersion.id,
      prismaVersion.workflowId,
      prismaVersion.versionNumber,
      prismaVersion.definition as Record<string, any>,
      prismaVersion.publishedById,
      prismaVersion.publishedAt,
      prismaVersion.createdAt,
    );
  }
}
