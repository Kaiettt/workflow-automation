import { Injectable } from '@nestjs/common';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';
import { PrismaService } from '../../../../../shared-infra/src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaWorkflowDraftRepository implements WorkflowDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(draft: WorkflowDraft): Promise<void> {
    await this.prisma.workflowDraft.upsert({
      where: { workflowId: draft.workflowId },
      create: {
        workflowId: draft.workflowId,
        definition: draft.definition as Prisma.InputJsonValue,
      },
      update: {
        definition: draft.definition as Prisma.InputJsonValue,
      },
    });
  }
}
