import { Injectable } from '@nestjs/common';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersion } from '../../domain/entities/workflow-version.entity';
import { PrismaService } from '@app/database/prisma/prisma.service';
import { WorkflowVersionMapper } from './mappers/workflow-version.mapper';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaWorkflowVersionRepository implements WorkflowVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<WorkflowVersion | null> {
    const record = await this.prisma.workflowVersion.findUnique({
      where: { id },
    });
    if (!record) return null;
    return WorkflowVersionMapper.toDomain(record);
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowVersion[]> {
    const records = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
    });
    return records.map(WorkflowVersionMapper.toDomain);
  }

  async findLatestByWorkflowId(
    workflowId: string,
  ): Promise<WorkflowVersion | null> {
    const record = await this.prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
    });
    if (!record) return null;
    return WorkflowVersionMapper.toDomain(record);
  }

  async save(version: WorkflowVersion): Promise<void> {
    await this.prisma.workflowVersion.upsert({
      where: { id: version.id },
      update: {
        definition: version.definition as Prisma.InputJsonValue,
      },
      create: {
        id: version.id,
        workflowId: version.workflowId,
        versionNumber: version.versionNumber,
        definition: version.definition as Prisma.InputJsonValue,
        publishedById: version.publishedById,
        publishedAt: version.publishedAt,
      },
    });
  }
}
