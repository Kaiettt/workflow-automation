import { Injectable } from '@nestjs/common';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersion } from '../../domain/entities/workflow-version.entity';

@Injectable()
export class PrismaWorkflowVersionRepository implements WorkflowVersionRepository {
  private versions: WorkflowVersion[] = []; // In-memory mock for MVP until Prisma schema is updated

  async findById(id: string): Promise<WorkflowVersion | null> {
    return this.versions.find(v => v.id === id) || null;
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowVersion[]> {
    return this.versions.filter(v => v.workflowId === workflowId);
  }

  async findLatestByWorkflowId(workflowId: string): Promise<WorkflowVersion | null> {
    const wfVersions = await this.findByWorkflowId(workflowId);
    if (wfVersions.length === 0) return null;
    return wfVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  }

  async save(version: WorkflowVersion): Promise<void> {
    const idx = this.versions.findIndex(v => v.id === version.id);
    if (idx >= 0) {
      this.versions[idx] = version;
    } else {
      this.versions.push(version);
    }
  }
}
