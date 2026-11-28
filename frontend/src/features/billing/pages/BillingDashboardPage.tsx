import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBillingActions, useBillingPlans, useBillingSubscription, usePaymentHistory } from '../api/billing.api';
import { ExpiredWarningBanner } from '../components/ExpiredWarningBanner';
import { PaymentHistoryTable } from '../components/PaymentHistoryTable';
import { PricingPlansGrid } from '../components/PricingPlansGrid';
import { QuotaUsageCard } from '../components/QuotaUsageCard';
import { Button } from '@/components/ui/button';

export function BillingDashboardPage() {
  const subscription = useBillingSubscription();
  const plans = useBillingPlans();
  const history = usePaymentHistory();
  const actions = useBillingActions();
  const [redirectError, setRedirectError] = useState(false);
  const actionError = actions.checkout.error ?? actions.downgrade.error ?? actions.switchToFree.error;
  const busy = actions.checkout.isPending || actions.downgrade.isPending || actions.switchToFree.isPending;

  const startCheckout = (planId: string) => {
    setRedirectError(false);
    actions.checkout.mutate(planId, { onSuccess: ({ paymentUrl }) => {
      try {
        const target = new URL(paymentUrl);
        if (target.protocol !== 'https:') throw new Error('Invalid payment URL');
        window.location.assign(target.toString());
      } catch {
        setRedirectError(true);
      }
    } });
  };
  const scheduleDowngrade = (code: Parameters<typeof actions.downgrade.mutate>[0]) => {
    actions.downgrade.mutate(code);
  };
  const switchToFree = () => {
    actions.switchToFree.mutate();
  };

  if (subscription.isPending || plans.isPending || history.isPending) return <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8"><p role="status">Loading billing…</p></main>;
  if (subscription.isError || plans.isError || history.isError) return <main className="container mx-auto max-w-7xl space-y-4 px-4 py-8"><h1 className="text-2xl font-bold">Billing</h1><p role="alert">Could not load billing information. Check your connection and try again.</p><Button variant="outline" onClick={() => { void subscription.refetch(); void plans.refetch(); void history.refetch(); }}>Try again</Button></main>;

  const current = subscription.data;
  return <main className="container mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Workspace</p><h1 className="text-2xl font-bold">Billing</h1></div><Button variant="outline" nativeButton={false} render={<Link to="/workflows" />}>Back to workflows</Button></header>
    {current?.status === 'EXPIRED' && <ExpiredWarningBanner busy={busy} onSwitch={() => void switchToFree()} />}
    {current ? <QuotaUsageCard subscription={current} /> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No subscription is associated with this account.</p>}
    {(actionError || redirectError) && <p role="alert" className="text-sm text-destructive">{redirectError ? 'Could not open the secure payment page. Please try again.' : 'Billing action failed. Please try again.'}</p>}
    {actions.downgrade.isSuccess && <p role="status" className="text-sm text-muted-foreground">Downgrade scheduled for the next billing cycle.</p>}
    {actions.switchToFree.isSuccess && <p role="status" className="text-sm text-muted-foreground">Switched to the Free plan.</p>}
    {plans.data && <PricingPlansGrid plans={plans.data} subscription={current} busy={busy} onCheckout={(plan) => void startCheckout(plan.id)} onDowngrade={(plan) => void scheduleDowngrade(plan.code)} />}
    {history.data && <PaymentHistoryTable orders={history.data} />}
  </main>;
}
