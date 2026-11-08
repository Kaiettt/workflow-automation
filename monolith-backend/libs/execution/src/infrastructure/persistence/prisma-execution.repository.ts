import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import {
  ExecutionStatus,
  TriggerType,
} from '../../domain/constants/execution.constants';
import {
  ExecutionRecord,
  ExecutionHistoryItem,
  ExecutionHistoryPage,
  ExecutionHistoryQuery,
  ExecutionStartRecord,
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
        idempotencyKey: input.idempotencyKey,
        status: input.status,
        queuedAt: input.queuedAt,
        startedAt: input.startedAt,
        context:
          input.context === undefined ? undefined : jsonValue(input.context),
      },
      select: { id: true },
    });
    return row.id;
  }

  async findExecutionByIdempotencyKey(
    actorId: string,
    idempotencyKey: string,
  ): Promise<ExecutionStartRecord | null> {
    const row = await this.prisma.execution.findFirst({
      where: { triggeredById: actorId, idempotencyKey },
      select: {
        id: true,
        workflowId: true,
        workflowVersionId: true,
        triggerType: true,
        status: true,
        queuedAt: true,
        startedAt: true,
      },
    });
    if (!row) return null;
    return {
      ...row,
      triggerType: row.triggerType as TriggerType,
      status: row.status as ExecutionStatus,
    };
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
    const existing = await this.prisma.executionNodeLog.findFirst({
      where: { executionId, nodeId: log.nodeId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.executionNodeLog.update({
        where: { id: existing.id },
        data: {
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
      return;
    }

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

  async claimQueuedExecution(id: string, startedAt: Date): Promise<boolean> {
    const { count } = await this.prisma.execution.updateMany({
      where: { id, status: ExecutionStatus.QUEUED },
      data: { status: ExecutionStatus.RUNNING, startedAt },
    });
    return count === 1;
  }

  async failUnfinishedExecution(id: string, finishedAt: Date): Promise<void> {
    await this.prisma.execution.updateMany({
      where: {
        id,
        status: { in: [ExecutionStatus.QUEUED, ExecutionStatus.RUNNING] },
      },
      data: { status: ExecutionStatus.FAILED, finishedAt },
    });
  }

  async failStaleExecutions(startedBefore: Date): Promise<number> {
    const { count } = await this.prisma.execution.updateMany({
      where: {
        status: ExecutionStatus.RUNNING,
        triggerType: TriggerType.MANUAL,
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
      workflowId: row.workflowId,
      workflowVersionId: row.workflowVersionId,
      triggerType: row.triggerType as TriggerType,
      status: row.status,
      queuedAt: row.queuedAt,
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

  async findExecutionResultForOwner(
    id: string,
    ownerId: string,
  ): Promise<unknown> {
    const row = await this.prisma.execution.findFirst({
      where: { id, workflow: { is: { ownerId } } },
      include: { nodeLogs: { orderBy: { startedAt: 'asc' } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      workflowId: row.workflowId,
      workflowVersionId: row.workflowVersionId,
      triggerType: row.triggerType,
      status: row.status,
      queuedAt: row.queuedAt,
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

  async listExecutionHistoryForOwner(
    query: ExecutionHistoryQuery,
  ): Promise<ExecutionHistoryPage> {
    const rows = await this.prisma.execution.findMany({
      where: {
        workflowId: query.workflowId,
        workflow: { is: { ownerId: query.ownerId } },
        ...(query.workflowVersionId
          ? { workflowVersionId: query.workflowVersionId }
          : {}),
      },
      orderBy: [{ queuedAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      select: {
        id: true,
        workflowId: true,
        workflowVersionId: true,
        triggerType: true,
        status: true,
        queuedAt: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
      },
    });
    const hasMore = rows.length > query.limit;
    const items: ExecutionHistoryItem[] = rows
      .slice(0, query.limit)
      .map((row) => ({
        ...row,
        triggerType: row.triggerType as TriggerType,
        status: row.status as ExecutionStatus,
      }));
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }
}
