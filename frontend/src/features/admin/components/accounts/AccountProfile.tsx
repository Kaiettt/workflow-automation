import { UserRound } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountRoleBadge, AccountStatusBadge } from '@/features/admin/components/AccountBadges';
import type { Account } from '@/features/admin/types/admin.types';
import { formatDateTime } from '@/features/admin/utils/format';

export function AccountProfile({ account }: { account: Account }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-5">
        <div className="space-y-1.5"><CardTitle className="text-sm">Account information</CardTitle><CardDescription className="text-xs">Profile details and account metadata</CardDescription></div>
        <UserRound className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm sm:gap-x-6">
          <div><dt className="mb-1.5 text-xs text-muted-foreground">Email</dt><dd className="break-all">{account.email}</dd></div>
          <div><dt className="mb-1.5 text-xs text-muted-foreground">Role</dt><dd><AccountRoleBadge role={account.role} /></dd></div>
          <div><dt className="mb-1.5 text-xs text-muted-foreground">Created</dt><dd className="text-xs">{formatDateTime(account.createdAt)}</dd></div>
          <div><dt className="mb-1.5 text-xs text-muted-foreground">Status</dt><dd><AccountStatusBadge isActive={account.isActive} /></dd></div>
          <div><dt className="mb-1.5 text-xs text-muted-foreground">Last updated</dt><dd className="text-xs">{formatDateTime(account.updatedAt)}</dd></div>
          <div><dt className="mb-1.5 text-xs text-muted-foreground">Account ID</dt><dd className="break-all font-mono text-[11px] text-muted-foreground">{account.id}</dd></div>
        </dl>
      </CardContent>
    </Card>
  );
}
