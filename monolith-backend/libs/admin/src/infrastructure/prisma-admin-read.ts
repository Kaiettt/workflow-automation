import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { safeExecutionErrorCode } from '@app/execution/application/execution-error-code';
import { AdminReadPort } from '../application/admin-read.port';
import type {
  DashboardFilter,
  UserFilter,
} from '../application/admin-read.port';

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
}
