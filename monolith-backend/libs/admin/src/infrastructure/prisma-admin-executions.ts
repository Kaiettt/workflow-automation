import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { safeExecutionErrorCode } from '@app/execution';
import type {
  AdminExecutionDetail,
  AdminExecutionFilter,
  AdminExecutionPage,
  AdminExecutionSummary,
} from '../application/admin-execution.types';

// Keep this projection explicit: Admin never loads client payloads or definitions.
const executionSelect = {
  id: true,
  workflowId: true,
  workflow: {
    select: {
      name: true,
      ownerId: true,
      owner: { select: { name: true, email: true } },
    },
  },
  workflowVersionId: true,
  workflowVersion: { select: { versionNumber: true } },
  triggerType: true,
  status: true,
  queuedAt: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  errorCode: true,
  cancellationReason: true,
} satisfies Prisma.ExecutionSelect;
type ExecutionRow = Prisma.ExecutionGetPayload<{
  select: typeof executionSelect;
}>;
function summary(row: ExecutionRow): AdminExecutionSummary {
  return {
    id: row.id,
    workflowId: row.workflowId,
    workflowName: row.workflow.name,
    ownerId: row.workflow.ownerId,
    ownerName: row.workflow.owner.name,
    ownerEmail: row.workflow.owner.email,
    versionId: row.workflowVersionId,
    versionNumber: row.workflowVersion.versionNumber,
    triggerType: row.triggerType,
    status: row.status,
    queuedAt: row.queuedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    errorCode:
      row.status === 'FAILED' ? safeExecutionErrorCode(row.errorCode) : null,
    cancellationReason:
      row.status !== 'CANCELLED' || !row.cancellationReason
        ? null
        : row.cancellationReason === 'OWNER_SUSPENDED'
          ? 'OWNER_SUSPENDED'
          : 'UNCLASSIFIED_REASON',
  };
}
export async function readAdminExecutions(
  prisma: PrismaService,
  filter: AdminExecutionFilter,
): Promise<AdminExecutionPage> {
  const where: Prisma.ExecutionWhereInput = {
    id: filter.executionId,
    workflowId: filter.workflowId,
    ...(filter.ownerId ? { workflow: { ownerId: filter.ownerId } } : {}),
    status: filter.status,
    triggerType: filter.triggerType,
    queuedAt: { gte: filter.from, lt: filter.to },
  };
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.execution.findMany({
        where,
        select: executionSelect,
        orderBy: [{ queuedAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      });
      const total = await tx.execution.count({ where });
      return {
        items: rows.map(summary),
        total,
        page: filter.page,
        pageSize: filter.pageSize,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
const nodeLogSelect = {
  nodeId: true,
  nodeKey: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  retryCount: true,
  errorCode: true,
} satisfies Prisma.ExecutionNodeLogSelect;
export async function readAdminExecution(
  prisma: PrismaService,
  id: string,
): Promise<AdminExecutionDetail | null> {
  return prisma.$transaction(
    async (tx) => {
      const row = await tx.execution.findUnique({
        where: { id },
        select: {
          ...executionSelect,
          nodeLogs: {
            select: nodeLogSelect,
            orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (!row) return null;
      return {
        ...summary(row),
        nodeLogs: row.nodeLogs.map((log) => ({
          ...log,
          errorCode:
            log.status === 'FAILED' || log.status === 'TIMEOUT'
              ? safeExecutionErrorCode(log.errorCode)
              : null,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
