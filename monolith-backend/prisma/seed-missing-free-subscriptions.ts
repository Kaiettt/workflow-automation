import {
  PlanCode,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
} from '@prisma/client';

const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export async function seedMissingFreeSubscriptions(
  prisma: PrismaClient,
  now = new Date(),
): Promise<number> {
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { code: PlanCode.FREE },
    select: { id: true, monthlyQuota: true },
  });

  if (!freePlan) {
    throw new Error('Free subscription plan must be seeded first');
  }

  const users = await prisma.user.findMany({
    where: { subscription: null },
    select: { id: true },
  });
  const periodStart = now;
  const periodEnd = new Date(periodStart.getTime() + SUBSCRIPTION_PERIOD_MS);
  let createdCount = 0;

  for (const user of users) {
    try {
      await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.create({
          data: {
            userId: user.id,
            planId: freePlan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            nextPlanId: null,
            autoRenew: true,
          },
          select: { id: true },
        });

        await tx.subscriptionUsage.create({
          data: {
            subscriptionId: subscription.id,
            periodStart,
            periodEnd,
            totalQuota: freePlan.monthlyQuota,
            usedQuota: 0,
            manualUsage: 0,
            webhookUsage: 0,
            scheduleUsage: 0,
          },
        });
      });
      createdCount += 1;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Registration may have created the subscription after the initial query.
        continue;
      }
      throw error;
    }
  }

  return createdCount;
}
