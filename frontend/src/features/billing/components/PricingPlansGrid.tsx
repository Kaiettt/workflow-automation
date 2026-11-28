import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BillingPlan, CurrentSubscription } from '../types/billing.types';

interface Props {
  plans: BillingPlan[];
  subscription: CurrentSubscription | null;
  busy: boolean;
  onCheckout: (plan: BillingPlan) => void;
  onDowngrade: (plan: BillingPlan) => void;
}

export function PricingPlansGrid({ plans, subscription, busy, onCheckout, onDowngrade }: Props) {
  const currentPrice = subscription?.plan.priceVnd ?? 0;
  const canDowngrade = subscription?.status === 'ACTIVE';
  return <section aria-labelledby="pricing-heading" className="space-y-4">
    <h2 id="pricing-heading" className="text-xl font-semibold">Available plans</h2>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const current = plan.id === subscription?.plan.id;
        const upgrade = plan.priceVnd > currentPrice;
        return <Card key={plan.id}>
          <CardHeader><CardTitle>{plan.name}</CardTitle><p className="text-sm text-muted-foreground">{plan.monthlyQuota.toLocaleString()} runs / month</p></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xl font-bold">{plan.priceVnd === 0 ? 'Free' : `${plan.priceVnd.toLocaleString('vi-VN')} ₫`}<span className="text-xs font-normal text-muted-foreground"> / month</span></p>
            <Button className="w-full" variant={current ? 'outline' : 'default'} disabled={busy || current || (!upgrade && !canDowngrade)} onClick={() => upgrade ? onCheckout(plan) : onDowngrade(plan)}>
              {current ? 'Current plan' : upgrade ? 'Upgrade' : 'Schedule downgrade'}
            </Button>
          </CardContent>
        </Card>;
      })}
    </div>
  </section>;
}
