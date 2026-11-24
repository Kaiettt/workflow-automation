import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { safeExecutionErrorCode } from '@app/execution/application/execution-error-code';
import { AdminReadPort } from '../application/admin-read.port';
import type {
  ConnectorFilter,
  DashboardFilter,
  UserFilter,
} from '../application/admin-read.port';

import {
  readAdminNodeTypes,
  readAdminNodeType,
} from './prisma-admin-node-types';
import type { NodeTypeFilter } from '../application/node-type-admin.types';
import type { AdminExecutionFilter } from '../application/admin-execution.types';
import {
  readAdminExecutions,
  readAdminExecution,
} from './prisma-admin-executions';
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} as const;
@Injectable()
export class PrismaAdminRead extends AdminReadPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  executions(filter: AdminExecutionFilter) {
    return readAdminExecutions(this.prisma, filter);
  }
  execution(id: string) {
    return readAdminExecution(this.prisma, id);
  }
  nodeTypes(filter: NodeTypeFilter) {
    return readAdminNodeTypes(this.prisma, filter);
  }
  nodeType(key: string) {
    return readAdminNodeType(this.prisma, key);
  }
  async users(filter: UserFilter) {
    const where: Prisma.UserWhereInput = {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { email: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }
  async user(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        _count: {
          select: { ownedWorkflows: true, connectorCredentials: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Account not found');
    const executions = await this.prisma.execution.count({
      where: { workflow: { ownerId: id } },
    });
    const { _count, ...summary } = user;
    return {
      ...summary,
      counts: {
        workflows: _count.ownedWorkflows,
        credentials: _count.connectorCredentials,
        executions,
      },
    };
  }
  async workflows(id: string, filter: UserFilter) {
    if (!(await this.prisma.user.count({ where: { id } })))
      throw new NotFoundException('Account not found');
    const where = { ownerId: id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          active: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.workflow.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }
  async dashboard(filter: DashboardFilter) {
    const where = { queuedAt: { gte: filter.from, lt: filter.to } };
    return this.prisma.$transaction(
      async (tx) => {
        const accounts = await tx.user.groupBy({
          by: ['role', 'isActive'],
          _count: true,
        });
        const workflowCounts = await tx.workflow.groupBy({
          by: ['status'],
          _count: true,
        });
        const workflowActive = await tx.workflow.count({
          where: { active: true },
        });
        const executionCounts = await tx.execution.groupBy({
          by: ['status'],
          where,
          _count: true,
        });
        const errors = await tx.execution.groupBy({
          by: ['errorCode'],
          where: { ...where, status: 'FAILED' },
          _count: true,
        });
        const trend = await tx.$queryRaw<
          { day: string; status: string; count: number }[]
        >`SELECT to_char(queued_at AT TIME ZONE ${filter.timezone}, 'YYYY-MM-DD') AS day, status::text, COUNT(*)::int AS count FROM executions WHERE queued_at >= ${filter.from} AND queued_at < ${filter.to} GROUP BY 1,2 ORDER BY 1,2`;
        const users = {
          total: 0,
          clientsActive: 0,
          clientsInactive: 0,
          adminsActive: 0,
        };
        for (const row of accounts) {
          users.total += row._count;
          if (row.role === 'CLIENT')
            users[row.isActive ? 'clientsActive' : 'clientsInactive'] +=
              row._count;
          else if (row.isActive) users.adminsActive += row._count;
        }
        const workflows: Record<string, number> = {
          total: 0,
          active: workflowActive,
          DRAFT: 0,
          PUBLISHED: 0,
          ARCHIVED: 0,
        };
        for (const row of workflowCounts) {
          workflows[row.status] = row._count;
          workflows.total += row._count;
        }
        const executions: Record<string, number> = {
          QUEUED: 0,
          RUNNING: 0,
          SUCCESS: 0,
          FAILED: 0,
          CANCELLED: 0,
        };
        for (const row of executionCounts) executions[row.status] = row._count;
        const denominator = executions.SUCCESS + executions.FAILED;
        const errorGroups = new Map<string, number>();
        for (const row of errors) {
          const code = safeExecutionErrorCode(row.errorCode);
          errorGroups.set(code, (errorGroups.get(code) ?? 0) + row._count);
        }
        return {
          updatedAt: new Date(),
          from: filter.from,
          to: filter.to,
          timezone: filter.timezone,
          users,
          workflows,
          executions,
          successRate: denominator
            ? (executions.SUCCESS / denominator) * 100
            : null,
          trend,
          errors: [...errorGroups]
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async connectors(filter: ConnectorFilter) {
    const where: Prisma.ConnectorWhereInput = {
      ...(filter.authType ? { authType: filter.authType } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.allowNewCredentials !== undefined
        ? filter.allowNewCredentials === false
          ? { policy: { allowNewCredentials: false } }
          : {
              OR: [{ policy: null }, { policy: { allowNewCredentials: true } }],
            }
        : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { key: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [connectors, total] = await this.prisma.$transaction([
      this.prisma.connector.findMany({
        where,
        include: {
          policy: true,
          _count: { select: { credentials: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.connector.count({ where }),
    ]);

    const publishedWorkflows = await this.prisma.workflow.findMany({
      where: { status: 'PUBLISHED', currentVersionId: { not: null } },
      select: {
        id: true,
        currentVersion: { select: { definition: true } },
      },
    });

    const nodeTypes = await this.prisma.nodeTypeDefinition.findMany({
      where: { connectorId: { not: null } },
      select: { key: true, connectorId: true },
    });
    const connectorByNodeKey = new Map<string, string>();
    for (const nt of nodeTypes) {
      if (nt.connectorId) connectorByNodeKey.set(nt.key, nt.connectorId);
    }

    const credentials = await this.prisma.connectorCredential.findMany({
      select: { id: true, connectorId: true },
    });
    const connectorByCredId = new Map<string, string>();
    for (const c of credentials) {
      connectorByCredId.set(c.id, c.connectorId);
    }

    const workflowIdsByConnector = new Map<string, Set<string>>();
    for (const wf of publishedWorkflows) {
      const def = wf.currentVersion?.definition as {
        nodes?: Array<{
          type?: string;
          data?: {
            nodeType?: string;
            nodeKey?: string;
            credentialId?: string;
          };
        }>;
      } | null;
      if (!def?.nodes || !Array.isArray(def.nodes)) continue;

      for (const n of def.nodes) {
        const key = n.data?.nodeType || n.data?.nodeKey || n.type;
        const connIdFromNode = key ? connectorByNodeKey.get(key) : undefined;
        if (connIdFromNode) {
          if (!workflowIdsByConnector.has(connIdFromNode)) {
            workflowIdsByConnector.set(connIdFromNode, new Set());
          }
          workflowIdsByConnector.get(connIdFromNode)!.add(wf.id);
        }

        const credId = n.data?.credentialId;
        const connIdFromCred = credId
          ? connectorByCredId.get(credId)
          : undefined;
        if (connIdFromCred) {
          if (!workflowIdsByConnector.has(connIdFromCred)) {
            workflowIdsByConnector.set(connIdFromCred, new Set());
          }
          workflowIdsByConnector.get(connIdFromCred)!.add(wf.id);
        }
      }
    }

    const items = connectors.map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      authType: c.authType,
      isActive: c.isActive,
      allowNewCredentials: c.policy?.allowNewCredentials ?? true,
      revision: c.policy?.revision ?? 0,
      credentialCount: c._count.credentials,
      workflowCount: workflowIdsByConnector.get(c.id)?.size ?? 0,
      createdAt: c.createdAt,
      updatedAt: c.policy?.updatedAt ?? c.createdAt,
    }));

    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }

  async connector(id: string) {
    const connector = await this.prisma.connector.findUnique({
      where: { id },
      include: {
        policy: true,
        nodeTypes: {
          select: {
            id: true,
            key: true,
            displayName: true,
            category: true,
            isActive: true,
          },
        },
        _count: { select: { credentials: true } },
      },
    });
    if (!connector) throw new NotFoundException('Connector not found');

    const publishedWorkflows = await this.prisma.workflow.findMany({
      where: { status: 'PUBLISHED', currentVersionId: { not: null } },
      select: {
        id: true,
        currentVersion: { select: { definition: true } },
      },
    });

    const nodeTypeKeys = new Set(connector.nodeTypes.map((nt) => nt.key));
    const credIds = new Set(
      (
        await this.prisma.connectorCredential.findMany({
          where: { connectorId: id },
          select: { id: true },
        })
      ).map((c) => c.id),
    );

    const distinctWorkflows = new Set<string>();
    for (const wf of publishedWorkflows) {
      const def = wf.currentVersion?.definition as {
        nodes?: Array<{
          type?: string;
          data?: {
            nodeType?: string;
            nodeKey?: string;
            credentialId?: string;
          };
        }>;
      } | null;
      if (!def?.nodes || !Array.isArray(def.nodes)) continue;
      for (const n of def.nodes) {
        const key = n.data?.nodeType || n.data?.nodeKey || n.type;
        if (key && nodeTypeKeys.has(key)) {
          distinctWorkflows.add(wf.id);
        }
        if (n.data?.credentialId && credIds.has(n.data.credentialId)) {
          distinctWorkflows.add(wf.id);
        }
      }
    }

    return {
      id: connector.id,
      key: connector.key,
      name: connector.name,
      authType: connector.authType,
      isActive: connector.isActive,
      allowNewCredentials: connector.policy?.allowNewCredentials ?? true,
      revision: connector.policy?.revision ?? 0,
      credentialCount: connector._count.credentials,
      workflowCount: distinctWorkflows.size,
      nodeTypes: connector.nodeTypes,
      createdAt: connector.createdAt,
      updatedAt: connector.policy?.updatedAt ?? connector.createdAt,
    };
  }
}
