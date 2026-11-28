import { PrismaClient, PlanCode } from '@prisma/client';

export const INITIAL_SUBSCRIPTION_PLANS = [
  {
    code: PlanCode.FREE,
    name: 'Free',
    priceVnd: 0,
    monthlyQuota: 100,
    isActive: true,
  },
  {
    code: PlanCode.STARTER,
    name: 'Starter',
    priceVnd: 99000,
    monthlyQuota: 1000,
    isActive: true,
  },
  {
    code: PlanCode.PRO,
    name: 'Pro',
    priceVnd: 299000,
    monthlyQuota: 5000,
    isActive: true,
  },
  {
    code: PlanCode.BUSINESS,
    name: 'Business',
    priceVnd: 799000,
    monthlyQuota: 20000,
    isActive: true,
  },
];

export async function seedSubscriptionPlans(prisma: PrismaClient) {
  console.log('Seeding subscription plans...');
  for (const plan of INITIAL_SUBSCRIPTION_PLANS) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { code: plan.code },
    });

    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { code: plan.code },
        data: plan,
      });
      console.log(`Updated plan: ${plan.code}`);
    } else {
      await prisma.subscriptionPlan.create({
        data: plan,
      });
      console.log(`Created plan: ${plan.code}`);
    }
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSubscriptionPlans(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
