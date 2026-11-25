import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { isAdminAuditAction } from '../application/admin-audit.types';
import type {
  AdminAuditDetail,
  AdminAuditFilter,
  AdminAuditPage,
  AdminAuditSummary,
} from '../application/admin-audit.types';
import { projectAdminAuditSnapshot } from '../application/admin-audit-snapshot';

const auditSelect = {
  id: true,
  actorType: true,
  actorId: true,
  action: true,
  targetType: true,
  targetId: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.AdminAuditEventSelect;
type AuditRow = Prisma.AdminAuditEventGetPayload<{
  select: typeof auditSelect;
}>;
async function metadata(
  tx: Prisma.TransactionClient,
  rows: AuditRow[],
): Promise<AdminAuditSummary[]> {
  const userIds = new Set<string>();
  const connectorIds = new Set<string>();
  const nodeIds = new Set<string>();
  for (const row of rows) {
    if (row.actorId) userIds.add(row.actorId);
    if (row.targetType === 'USER') userIds.add(row.targetId);
    if (row.targetType === 'CONNECTOR') connectorIds.add(row.targetId);
    if (row.targetType === 'NODE_TYPE') nodeIds.add(row.targetId);
  }
  const users = userIds.size
    ? await tx.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const connectors = connectorIds.size
    ? await tx.connector.findMany({
        where: { id: { in: [...connectorIds] } },
        select: { id: true, name: true },
      })
    : [];
  const nodes = nodeIds.size
    ? await tx.nodeTypeDefinition.findMany({
        where: { id: { in: [...nodeIds] } },
        select: { id: true, displayName: true },
      })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const connectorById = new Map(
    connectors.map((connector) => [connector.id, connector.name]),
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node.displayName]));
  return rows.map((row) => ({
    id: row.id,
    actorType:
      row.actorType === 'ADMIN' || row.actorType === 'SYSTEM'
        ? row.actorType
        : 'UNKNOWN',
    actorId: row.actorId,
    actorName: row.actorId ? (userById.get(row.actorId)?.name ?? null) : null,
    actorEmail: row.actorId ? (userById.get(row.actorId)?.email ?? null) : null,
    action: isAdminAuditAction(row.action) ? row.action : 'UNKNOWN_ACTION',
    targetType:
      row.targetType === 'USER' ||
      row.targetType === 'CONNECTOR' ||
      row.targetType === 'NODE_TYPE'
        ? row.targetType
        : 'UNKNOWN',
    targetId: row.targetId,
    targetName:
      row.targetType === 'USER'
        ? (userById.get(row.targetId)?.name ?? null)
        : row.targetType === 'CONNECTOR'
          ? (connectorById.get(row.targetId) ?? null)
          : row.targetType === 'NODE_TYPE'
            ? (nodeById.get(row.targetId) ?? null)
            : null,
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}
export async function readAdminAuditEvents(
  prisma: PrismaService,
  filter: AdminAuditFilter,
): Promise<AdminAuditPage> {
  const where: Prisma.AdminAuditEventWhereInput = {
    actorId: filter.actorId,
    actorType: filter.actorType,
    action: filter.action,
    targetType: filter.targetType,
    targetId: filter.targetId,
    createdAt: { gte: filter.from, lt: filter.to },
  };
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.adminAuditEvent.findMany({
        where,
        select: auditSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      });
      const total = await tx.adminAuditEvent.count({ where });
      return {
        items: await metadata(tx, rows),
        total,
        page: filter.page,
        pageSize: filter.pageSize,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function readAdminAuditEvent(
  prisma: PrismaService,
  id: string,
): Promise<AdminAuditDetail | null> {
  return prisma.$transaction(
    async (tx) => {
      const row = await tx.adminAuditEvent.findUnique({
        where: { id },
        select: { ...auditSelect, before: true, after: true },
      });
      if (!row) return null;
      const [summary] = await metadata(tx, [row]);
      return {
        ...summary,
        before: projectAdminAuditSnapshot(
          summary.action,
          summary.targetType,
          row.before,
        ),
        after: projectAdminAuditSnapshot(
          summary.action,
          summary.targetType,
          row.after,
        ),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
