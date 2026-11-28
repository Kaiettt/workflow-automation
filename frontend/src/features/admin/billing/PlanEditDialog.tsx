import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BillingPlanAdmin } from '../types/admin.types';
import { useUpdateBillingPlan } from './useAdminBilling';

const MAX_PLAN_VALUE = 1_000_000_000;

export function PlanEditDialog({ plan, open, onClose }: { plan: BillingPlanAdmin | null; open: boolean; onClose: () => void }) {
  const [price, setPrice] = useState(String(plan?.priceVnd ?? 0));
  const [quota, setQuota] = useState(String(plan?.monthlyQuota ?? 0));
  const [active, setActive] = useState(plan?.isActive ?? true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previousDialogState, setPreviousDialogState] = useState({ planId: plan?.id ?? null, open });
  const mutation = useUpdateBillingPlan();

  if (plan && (plan.id !== previousDialogState.planId || (open && !previousDialogState.open))) {
    setPreviousDialogState({ planId: plan.id, open });
    setPrice(String(plan.priceVnd)); setQuota(String(plan.monthlyQuota)); setActive(plan.isActive);
    setReason(''); setError(null);
  }
  if (!plan) return null;
  const priceValue = Number(price);
  const quotaValue = Number(quota);
  const trimmedReason = reason.trim();
  const valid = price.trim() !== '' && quota.trim() !== '' && Number.isSafeInteger(priceValue) && priceValue >= 0 && priceValue <= MAX_PLAN_VALUE && Number.isSafeInteger(quotaValue) && quotaValue >= 0 && quotaValue <= MAX_PLAN_VALUE && trimmedReason.length >= 5 && trimmedReason.length <= 500 && (priceValue !== plan.priceVnd || quotaValue !== plan.monthlyQuota || active !== plan.isActive);

  const save = async () => {
    setError(null);
    try {
      await mutation.mutateAsync({ id: plan.id, payload: { priceVnd: priceValue, monthlyQuota: quotaValue, isActive: active, expectedRevision: plan.revision, reason: trimmedReason } });
      onClose();
    } catch (caught: unknown) {
      if (typeof caught === 'object' && caught !== null && 'response' in caught) {
        const response = caught.response;
        if (typeof response === 'object' && response !== null && 'data' in response) {
          const data = response.data;
          if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') { setError(data.message); return; }
        }
      }
      setError('Could not update plan. Reload the plan list and try again.');
    }
  };

  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Edit {plan.name}</DialogTitle><DialogDescription>Changes affect new orders and usage periods. Existing subscriptions and orders keep their recorded terms.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="plan-price">Price (VND)</Label><Input id="plan-price" type="number" min="0" max={MAX_PLAN_VALUE} step="1" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="plan-quota">Monthly quota</Label><Input id="plan-quota" type="number" min="0" max={MAX_PLAN_VALUE} step="1" value={quota} onChange={(event) => setQuota(event.target.value)} /></div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Plan is active</label>
        <div className="space-y-1"><Label htmlFor="plan-reason">Reason (5–500 characters)</Label><Textarea id="plan-reason" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button><Button onClick={() => void save()} disabled={!valid || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save plan'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
