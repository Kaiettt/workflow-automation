import { AdminController } from '@app/admin/presentation/admin.controller';
import { AdminReadQuery } from '@app/admin/application/admin-read.query';
import { UpdateSubscriptionPlanCommand } from '@app/admin/application/update-subscription-plan.command';
import { ROLES_KEY } from '@app/auth/infrastructure/decorators/roles.decorator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@app/auth/infrastructure/guards/roles.guard';

describe('Admin billing endpoints (SCENARIO-SUB-12, SCENARIO-SUB-12-SEARCH)', () => {
  const queries = { execute: jest.fn() };
  const commands = { execute: jest.fn() };
  const controller = new AdminController(queries as never, commands as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects billing routes with JWT and ADMIN role guards', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
      expect.any(Function),
    ]);
  });

  it('dispatches subscription search filters through the admin read query', async () => {
    queries.execute.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
    });
    await controller.billingSubscriptions({
      page: 2,
      pageSize: 10,
      q: ' client@example.test ',
      status: 'ACTIVE',
      planId: 'plan-id',
    });
    expect(queries.execute).toHaveBeenCalledWith(
      new AdminReadQuery({
        kind: 'billingSubscriptions',
        filter: {
          page: 2,
          pageSize: 10,
          q: 'client@example.test',
          status: 'ACTIVE',
          planId: 'plan-id',
        },
      }),
    );
  });

  it('dispatches plan edits with actor identity and optimistic revision', async () => {
    const admin = {
      id: 'admin-id',
      email: 'admin@example.test',
      name: 'Admin',
      role: 'ADMIN' as const,
    };
    const change = {
      priceVnd: 349000,
      monthlyQuota: 500,
      isActive: true,
      expectedRevision: 2,
      reason: 'Annual pricing update',
    };
    await controller.updateBillingPlan('plan-id', change, admin);
    expect(commands.execute).toHaveBeenCalledWith(
      new UpdateSubscriptionPlanCommand({
        ...change,
        planId: 'plan-id',
        adminId: admin.id,
      }),
    );
  });

  it('requests revenue for the specified period', async () => {
    const from = '2026-01-01T00:00:00.000Z';
    const to = '2026-02-01T00:00:00.000Z';
    await controller.billingRevenue({ from, to });
    expect(queries.execute).toHaveBeenCalledWith(
      new AdminReadQuery({
        kind: 'billingRevenue',
        filter: { from: new Date(from), to: new Date(to) },
      }),
    );
  });
});
