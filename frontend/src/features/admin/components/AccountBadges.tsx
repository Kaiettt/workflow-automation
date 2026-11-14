import { Shield, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/features/auth/types/auth.types';

export function AccountRoleBadge({ role }: { role: UserRole }) {
  const Icon = role === 'ADMIN' ? Shield : UserRound;
  return <Badge variant="outline" className="gap-1.5 font-medium"><Icon className="hidden size-3 sm:inline-block" />{role === 'ADMIN' ? 'Admin' : 'Client'}</Badge>;
}

export function AccountStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant="secondary" className={cn('gap-1.5 font-medium', isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 text-destructive')}>
      <span className={cn('size-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-destructive')} />
      {isActive ? 'Active' : 'Suspended'}
    </Badge>
  );
}
