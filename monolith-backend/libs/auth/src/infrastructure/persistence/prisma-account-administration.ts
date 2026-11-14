import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import { AccountAdministrationPort } from '../../application/ports/account-administration.port';
import type { AccountChange } from '../../application/ports/account-administration.port';

export const accountSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} as const;

function reasonValue(reason: string) {
  const value = reason.trim();
  if (value.length < 5 || value.length > 500)
    throw new BadRequestException('Reason must contain 5–500 characters');
  return value;
}

@Injectable()
export class PrismaAccountAdministration extends AccountAdministrationPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async change(input: AccountChange) {
    const reason = reasonValue(input.reason);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7261101)::text`;
      await tx.$queryRaw`SELECT id FROM users WHERE id IN (${input.actorId}::uuid, ${input.targetId}::uuid) ORDER BY id FOR UPDATE`;
      const actor = await tx.user.findUnique({ where: { id: input.actorId } });
      if (!actor?.isActive || actor.role !== 'ADMIN')
        throw new ForbiddenException('Admin access required');
      const target = await tx.user.findUnique({
        where: { id: input.targetId },
        select: accountSummarySelect,
      });
      if (!target) throw new NotFoundException('Account not found');
      if (input.actorId === target.id)
        throw new ConflictException({
          code: 'SELF_ADMIN_CHANGE_FORBIDDEN',
          message: 'Cannot change your own role or account status',
        });
      if (target.revision !== input.expectedRevision)
        throw new ConflictException({
          code: 'STALE_REVISION',
          message: 'Account changed; reload before continuing',
        });
      const role = input.role ?? target.role;
      const isActive = input.isActive ?? target.isActive;
      if (input.role === 'ADMIN' && target.role !== 'ADMIN' && !target.isActive)
        throw new ConflictException({
          code: 'TARGET_USER_INACTIVE',
          message: 'Reactivate the account before granting Admin',
        });
      if (role === target.role && isActive === target.isActive)
        return { ...target, auditEventId: null };
      if (
        target.role === 'ADMIN' &&
        target.isActive &&
        (role !== 'ADMIN' || !isActive)
      ) {
        if (
          (await tx.user.count({
            where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
          })) === 0
        ) {
          throw new ConflictException({
            code: 'LAST_ACTIVE_ADMIN',
            message: 'At least one active Admin must remain',
          });
        }
      }
      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          role,
          isActive,
          revision: { increment: 1 },
          sessionVersion: { increment: 1 },
        },
      });
      const audit = await tx.adminAuditEvent.create({
        data: {
          actorType: 'ADMIN',
          actorId: actor.id,
          targetType: 'USER',
          targetId: target.id,
          action:
            role !== target.role
              ? 'USER_ROLE_CHANGED'
              : isActive
                ? 'USER_REACTIVATED'
                : 'USER_SUSPENDED',
          reason,
          before: { role: target.role, isActive: target.isActive },
          after: { role, isActive },
        },
      });
      await tx.sessionRevocation.create({
        data: { userId: target.id, sessionVersion: updated.sessionVersion },
      });
      const summary = await tx.user.findUniqueOrThrow({
        where: { id: target.id },
        select: accountSummarySelect,
      });
      return { ...summary, auditEventId: audit.id };
    });
  }

  async bootstrap(email: string, reason: string) {
    const normalizedReason = reasonValue(reason);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7261101)::text`;
      if (await tx.user.count({ where: { role: 'ADMIN', isActive: true } }))
        throw new ConflictException(
          'An active Admin already exists; use account administration',
        );
      const target = await tx.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (!target?.isActive)
        throw new NotFoundException(
          'An active, registered account is required',
        );
      const user = await tx.user.update({
        where: { id: target.id },
        data: {
          role: 'ADMIN',
          revision: { increment: 1 },
          sessionVersion: { increment: 1 },
        },
        select: accountSummarySelect,
      });
      const audit = await tx.adminAuditEvent.create({
        data: {
          actorType: 'SYSTEM',
          targetType: 'USER',
          targetId: target.id,
          action: 'ADMIN_BOOTSTRAPPED',
          reason: normalizedReason,
          before: { role: target.role, isActive: target.isActive },
          after: { role: 'ADMIN', isActive: true },
        },
      });
      await tx.sessionRevocation.create({
        data: { userId: target.id, sessionVersion: target.sessionVersion + 1 },
      });
      return { ...user, auditEventId: audit.id };
    });
  }
}
