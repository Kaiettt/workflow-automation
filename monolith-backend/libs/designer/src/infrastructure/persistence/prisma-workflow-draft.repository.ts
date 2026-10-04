import { Injectable } from '@nestjs/common';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { WorkflowDraftMapper } from './mappers/workflow-draft.mapper';

@Injectable()
export class PrismaWorkflowDraftRepository implements WorkflowDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(workflowId: string): Promise<WorkflowDraft | null> {
    const record = await this.prisma.workflowDraft.findUnique({
      where: { workflowId },
    });
    if (!record) return null;
    return WorkflowDraftMapper.toDomain(record);
  }

  async upsert(draft: WorkflowDraft): Promise<void> {
    await this.prisma.workflowDraft.upsert({
      where: { workflowId: draft.workflowId },
      create: {
        workflowId: draft.workflowId,
        definition: draft.definition as Prisma.InputJsonValue,
        validationErrors:
          draft.validationErrors === null
            ? Prisma.DbNull
            : (draft.validationErrors as Prisma.InputJsonValue),
      },
      update: {
        definition: draft.definition as Prisma.InputJsonValue,
        validationErrors:
          draft.validationErrors === null
            ? Prisma.DbNull
            : (draft.validationErrors as Prisma.InputJsonValue),
      },
    });
  }
}
