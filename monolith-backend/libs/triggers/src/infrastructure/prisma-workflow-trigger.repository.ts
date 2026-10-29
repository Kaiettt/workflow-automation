import { Injectable } from '@nestjs/common';
import { WorkflowTrigger as WorkflowTriggerRow } from '@prisma/client';
import { PrismaService } from '@app/database';
import { WorkflowTriggerRepository } from '../domain/workflow-trigger.repository';
import {
  NewWorkflowTrigger,
  TriggerChannel,
  WorkflowTrigger,
} from '../domain/workflow-trigger';

const toDomain = (row: WorkflowTriggerRow): WorkflowTrigger => ({
  id: row.id,
  workflowId: row.workflowId,
  workflowVersionId: row.workflowVersionId,
  nodeId: row.nodeId,
  triggerKey: row.triggerKey,
  channel: row.channel as TriggerChannel,
  routingKey: row.routingKey,
  isActive: row.isActive,
  createdAt: row.createdAt,
});

@Injectable()
export class PrismaWorkflowTriggerRepository implements WorkflowTriggerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(
    channel: TriggerChannel,
    routingKey: string,
  ): Promise<WorkflowTrigger | null> {
    const row = await this.prisma.workflowTrigger.findFirst({
      where: { channel, routingKey, isActive: true },
    });
    return row ? toDomain(row) : null;
  }

  async findByWorkflow(workflowId: string): Promise<WorkflowTrigger[]> {
    const rows = await this.prisma.workflowTrigger.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async replaceActive(
    workflowId: string,
    workflowVersionId: string,
    triggers: NewWorkflowTrigger[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.workflowTrigger.updateMany({
        where: { workflowId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.workflowTrigger.createMany({
        data: triggers.map((trigger) => ({
          ...trigger,
          workflowId,
          workflowVersionId,
        })),
      }),
    ]);
  }

  async findWorkflowOwnerId(workflowId: string): Promise<string | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { ownerId: true },
    });
    return workflow?.ownerId ?? null;
  }
}
