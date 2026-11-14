import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Activity, ArrowLeft, CircleAlert, CircleCheck, KeyRound, Workflow } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { MetricCard } from '@/features/admin/components/MetricCard';
import { QueryFeedback } from '@/features/admin/components/QueryFeedback';
import { AccountAccessCard } from '@/features/admin/components/accounts/AccountAccessCard';
import { AccountChangeDialog } from '@/features/admin/components/accounts/AccountChangeDialog';
import { AccountProfile } from '@/features/admin/components/accounts/AccountProfile';
import { AccountWorkflows } from '@/features/admin/components/accounts/AccountWorkflows';
import { useAccount, useChangeAccount } from '@/features/admin/hooks/useAdmin';
import type { Account, AccountChangeAction } from '@/features/admin/types/admin.types';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [page, setPage] = useState(1);
  const account = useAccount(id);
  const mutation = useChangeAccount();
  const actorId = useAuthStore((state) => state.user?.id);
  const [action, setAction] = useState<AccountChangeAction | null>(null);
  const [reviewed, setReviewed] = useState<Account | null>(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const user = account.data;

  function reviewChange(nextAction: AccountChangeAction) {
    if (!user) return;
    setReviewed(user);
    setAction(nextAction);
    setReason('');
    setFeedback(null);
  }

  async function confirm() {
    if (!reviewed || !action) return;
    try {
      await mutation.mutateAsync({ account: reviewed, change: action === 'active' ? { isActive: !reviewed.isActive } : { role: reviewed.role === 'ADMIN' ? 'CLIENT' : 'ADMIN' }, reason: reason.trim() });
      setAction(null);
      setReason('');
      setFeedback({ kind: 'success', text: 'Account updated successfully.' });
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 409) {
        setAction(null);
        setFeedback({ kind: 'error', text: 'This change was not applied, or the account changed. Account information has been refreshed. Review it before trying again.' });
      } else {
        setFeedback({ kind: 'error', text: 'Could not update the account. Please try again.' });
      }
    }
  }

  return (
    <>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-xs text-muted-foreground" nativeButton={false} render={<Link to="/admin/users" />}><ArrowLeft className="size-3.5" />Back to users</Button>
        <AdminPageHeader title={user?.name ?? 'Account details'} description="Account details, permissions, and workflow activity." eyebrow="User management" />
      </div>
      <QueryFeedback pending={account.isPending} error={account.isError} loadingText="Loading account…" errorText="Could not load the account." onRetry={() => void account.refetch()} />
      {feedback && <Alert variant={feedback.kind === 'error' ? 'destructive' : 'default'} role={feedback.kind === 'success' ? 'status' : 'alert'} className={feedback.kind === 'success' ? 'border-emerald-500/20 bg-emerald-500/5' : undefined}>
        {feedback.kind === 'success' ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleAlert className="size-4" />}
        <AlertDescription>{feedback.text}</AlertDescription>
      </Alert>}
      {user && (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <MetricCard title="Workflows" value={user.counts?.workflows ?? 0} detail="Workflows owned by this account" icon={Workflow} compactOnMobile />
            <MetricCard title="Credentials" value={user.counts?.credentials ?? 0} detail="Saved service connections" icon={KeyRound} compactOnMobile />
            <MetricCard title="Executions" value={user.counts?.executions ?? 0} detail="Executions across owned workflows" icon={Activity} compactOnMobile />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <AccountProfile account={user} />
            <AccountAccessCard account={user} isOwnAccount={actorId === user.id} onReview={reviewChange} />
          </div>
          <AccountWorkflows key={id} accountId={id} page={page} onPageChange={setPage} />
          {reviewed && <AccountChangeDialog account={reviewed} action={action} reason={reason} pending={mutation.isPending} onReasonChange={setReason} onClose={() => setAction(null)} onConfirm={() => void confirm()} />}
        </>
      )}
    </>
  );
}
