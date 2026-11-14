import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  compactOnMobile?: boolean;
}

export function MetricCard({ title, value, detail, icon: Icon, compactOnMobile = false }: MetricCardProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className={cn('text-xs font-medium text-muted-foreground', compactOnMobile && 'text-[10px] sm:text-xs')}>{title}</CardTitle>
        <Icon className={cn('size-4 text-muted-foreground', compactOnMobile && 'hidden sm:block')} />
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <p className="break-all text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{typeof value === 'number' ? value.toLocaleString('en-US') : value}</p>
        <p className={cn('mt-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs', compactOnMobile && 'hidden sm:block')}>{detail}</p>
      </CardContent>
    </Card>
  );
}
