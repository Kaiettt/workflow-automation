import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CurrentSubscription } from '../types/billing.types';

const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));

export function QuotaUsageCard({ subscription }: { subscription: CurrentSubscription }) {
  const usage = subscription.usage;
  const total = usage?.totalQuota ?? subscription.plan.monthlyQuota;
  const used = usage?.usedQuota ?? 0;
  const remaining = Math.max(0, total - used);
  const percentage = total === 0 ? 0 : Math.min(100, (used / total) * 100);

  return <Card>
    <CardHeader><CardTitle>Current plan: {subscription.plan.name}</CardTitle>
      <p className="text-sm text-muted-foreground">{date(subscription.currentPeriodStart)} – {date(subscription.currentPeriodEnd)}</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex justify-between text-sm"><span>Quota used</span><span>{used.toLocaleString()} / {total.toLocaleString()}</span></div>
      <div role="progressbar" aria-label="Quota used" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{remaining.toLocaleString()} runs remaining</p>
      <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
        {[["Manual", usage?.manualUsage ?? 0], ["Webhook", usage?.webhookUsage ?? 0], ["Schedule", usage?.scheduleUsage ?? 0]].map(([label, count]) =>
          <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{count}</dd></div>)}
      </dl>
    </CardContent>
  </Card>;
}
