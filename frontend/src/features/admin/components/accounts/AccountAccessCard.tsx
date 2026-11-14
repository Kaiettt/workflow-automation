import { Shield, ShieldCheck, UserRound, UserRoundCheck, UserRoundX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Account, AccountChangeAction } from '@/features/admin/types/admin.types';

interface AccountAccessCardProps {
  account: Account;
  isOwnAccount: boolean;
  onReview: (action: AccountChangeAction) => void;
}

export function AccountAccessCard({ account, isOwnAccount, onReview }: AccountAccessCardProps) {
  const StatusIcon = account.isActive ? UserRoundX : UserRoundCheck;
  const RoleIcon = account.role === 'ADMIN' ? UserRound : ShieldCheck;
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-5">
        <div className="space-y-1.5"><CardTitle className="text-sm">Access controls</CardTitle><CardDescription className="text-xs">Manage account status and permissions</CardDescription></div>
        <Shield className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        <Button className="h-9 w-full justify-start text-xs" variant={account.isActive ? 'destructive' : 'outline'} disabled={isOwnAccount} onClick={() => onReview('active')}>
          <StatusIcon className="size-3.5" />{account.isActive ? 'Suspend account' : 'Reactivate account'}
        </Button>
        <Button className="h-9 w-full justify-start text-xs" variant="outline" disabled={isOwnAccount || (!account.isActive && account.role === 'CLIENT')} onClick={() => onReview('role')}>
          <RoleIcon className="size-3.5" />Change to {account.role === 'ADMIN' ? 'Client' : 'Admin'}
        </Button>
        <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
          {isOwnAccount ? 'You cannot change your own role or suspend your own account.' : !account.isActive && account.role === 'CLIENT' ? 'Reactivate this account before granting Admin access.' : 'Every change requires a reason and confirmation.'}
        </p>
      </CardContent>
    </Card>
  );
}
