import { Injectable } from '@nestjs/common';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { Workflow } from '../../domain/entities/workflow.entity';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { WorkflowMapper } from './mappers/workflow.mapper';

@Injectable()
export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Workflow | null> {
    const record = await this.prisma.workflow.findUnique({ where: { id } });
    if (!record) return null;
    return WorkflowMapper.toDomain(record);
  }

  async create(workflow: Workflow): Promise<string> {
    const created = await this.prisma.workflow.create({
      data: {
        ...(workflow.id ? { id: workflow.id } : {}),
        name: workflow.name,
        ownerId: workflow.ownerId,
        status: workflow.status,
      },
    });
    return created.id;
  }

  async update(workflow: Workflow): Promise<void> {
    await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        name: workflow.name,
        ownerId: workflow.ownerId,
        status: workflow.status,
        description: workflow.description,
        currentVersionId: workflow.currentVersionId,
      },
    });
  }
}
