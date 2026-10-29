import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { ExecutionStatus } from '../../domain/constants/execution.constants';
import {
  ExecutionRecord,
  NodeLogRecord,
  ResolvedCredential,
  WorkflowVersionForExecution,
} from '../../domain/models/execution.types';

const jsonValue = (
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === null || value === undefined ? Prisma.JsonNull : value;

@Injectable()
export class PrismaExecutionRepository implements ExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVersion(id: string): Promise<WorkflowVersionForExecution | null> {
    const row = await this.prisma.workflowVersion.findUnique({
      where: { id },
      include: { workflow: { select: { ownerId: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      workflowId: row.workflowId,
      definition: row.definition,
      workflowOwnerId: row.workflow.ownerId,
    };
  }

  async createExecution(input: Omit<ExecutionRecord, 'id'>): Promise<string> {
    const row = await this.prisma.execution.create({
      data: {
        workflowId: input.workflowId,
        workflowVersionId: input.workflowVersionId,
        triggerType: input.triggerType,
        triggeredById: input.triggeredById,
        status: ExecutionStatus.RUNNING,
        startedAt: input.startedAt,
        context:
          input.context === undefined ? undefined : jsonValue(input.context),
      },
      select: { id: true },
    });
    return row.id;
  }

  async resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<ResolvedCredential> {
    const credential = await this.prisma.connectorCredential.findUnique({
      where: { id: credentialId },
      include: { connector: true },
    });
    if (!credential) {
      throw new Error('credential was not found');
    }
    if (credential.ownerId !== ownerId) {
      throw new Error('credential does not belong to this workflow owner');
    }

    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
      throw new Error('Credential decryption key is not configured');
    }

    const plaintext = EncryptionUtil.decrypt(
      credential.encryptedSecret,
      encryptionKey,
    );
    return {
      connectorKey: credential.connector.key,
      secret: JSON.parse(plaintext) as unknown,
    };
  }

  async saveNodeLog(executionId: string, log: NodeLogRecord): Promise<void> {
    await this.prisma.executionNodeLog.create({
      data: {
        executionId,
        nodeId: log.nodeId,
        nodeKey: log.nodeKey,
        status: log.status,
        input: jsonValue(log.input),
        output: jsonValue(log.output),
        errorMessage: log.errorMessage,
        startedAt: log.startedAt,
        finishedAt: log.finishedAt,
        durationMs: log.finishedAt.getTime() - log.startedAt.getTime(),
      },
    });
  }

  async finishExecution(
    id: string,
    status: ExecutionStatus,
    finishedAt: Date,
    durationMs: number,
  ): Promise<void> {
    await this.prisma.execution.update({
      where: { id },
      data: { status: status, finishedAt, durationMs },
    });
  }

  async failStaleExecutions(startedBefore: Date): Promise<number> {
    const { count } = await this.prisma.execution.updateMany({
      where: {
        status: ExecutionStatus.RUNNING,
        startedAt: { lt: startedBefore },
      },
      data: { status: ExecutionStatus.FAILED, finishedAt: new Date() },
    });
    return count;
  }

  async findExecutionResult(id: string): Promise<unknown> {
    const row = await this.prisma.execution.findUnique({
      where: { id },
      include: { nodeLogs: { orderBy: { startedAt: 'asc' } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.durationMs,
      nodeLogs: row.nodeLogs.map((log) => ({
        id: log.id,
        nodeId: log.nodeId,
        nodeKey: log.nodeKey,
        status: log.status as ExecutionStatus,
        input: log.input,
        output: log.output,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt,
        finishedAt: log.finishedAt,
        durationMs: log.durationMs,
      })),
    };
  }
}
