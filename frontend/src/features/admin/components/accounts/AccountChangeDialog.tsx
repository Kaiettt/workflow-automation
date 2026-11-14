import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Account, AccountChangeAction } from '@/features/admin/types/admin.types';

interface AccountChangeDialogProps {
  account: Account;
  action: AccountChangeAction | null;
  reason: string;
  pending: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function AccountChangeDialog({ account, action, reason, pending, onReasonChange, onClose, onConfirm }: AccountChangeDialogProps) {
  const title = action === 'role' ? 'Change account role' : account.isActive ? 'Suspend account' : 'Reactivate account';
  const description = action === 'role'
    ? `This account will change from ${account.role === 'ADMIN' ? 'Admin' : 'Client'} to ${account.role === 'ADMIN' ? 'Client' : 'Admin'}.`
    : account.isActive
      ? 'Sign-in and new executions will be blocked. Queued executions will be cancelled; running executions will finish. Account data will be retained.'
      : 'Sign-in and new events will be allowed again. Cancelled executions will not restart automatically.';

  return (
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            <span className="mb-2 block break-all font-medium text-foreground">{account.email}</span>
            {description} Existing sessions will be signed out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="change-reason">Reason (5–500 characters)</Label>
          <Textarea id="change-reason" value={reason} maxLength={500} rows={4} onChange={(event) => onReasonChange(event.target.value)} placeholder="Explain why this change is needed." disabled={pending} className="resize-none" />
          <div className="flex justify-between gap-3 text-[11px] text-muted-foreground"><span>Do not include secrets or Client data.</span><span className="shrink-0 tabular-nums">{reason.trim().length}/500</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button variant={action === 'active' && account.isActive ? 'destructive' : 'default'} disabled={pending || reason.trim().length < 5} onClick={onConfirm}>{pending ? 'Updating…' : 'Confirm change'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
