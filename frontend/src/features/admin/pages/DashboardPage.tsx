import { useState } from 'react';
import { Activity, CircleCheck, RefreshCw, UsersRound, Workflow } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { MetricCard } from '@/features/admin/components/MetricCard';
import { QueryFeedback } from '@/features/admin/components/QueryFeedback';
import { DashboardRangeFilter } from '@/features/admin/components/dashboard/DashboardRangeFilter';
import { ExecutionErrors, ExecutionStatus, ExecutionTrend } from '@/features/admin/components/dashboard/ExecutionPanels';
import { useDashboard } from '@/features/admin/hooks/useAdmin';
import type { DashboardFilter } from '@/features/admin/types/admin.types';

export function DashboardPage() {
  const [rollingDays, setRollingDays] = useState<number | undefined>(7);
  const [filter, setFilter] = useState<DashboardFilter>(() => {
    const to = new Date();
    return { from: new Date(to.getTime() - 7 * 86_400_000).toISOString(), to: to.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  });
  const dashboard = useDashboard(filter, rollingDays);
  const data = dashboard.data;

  return (
    <>
      <AdminPageHeader title="Platform overview" description="Monitor usage, execution performance, and account access." actions={
        <Button variant="outline" className="h-9 gap-2 text-xs" onClick={() => void dashboard.refetch()} disabled={dashboard.isFetching}>
          <RefreshCw className={dashboard.isFetching ? 'size-3.5 animate-spin' : 'size-3.5'} />Refresh
        </Button>
      } />
      <div className="space-y-3">
        <DashboardRangeFilter filter={data ? { from: data.from, to: data.to, timezone: data.timezone } : filter} rollingDays={rollingDays} updatedAt={data?.updatedAt} onPreset={(days) => {
          const to = new Date();
          setFilter({ ...filter, from: new Date(to.getTime() - days * 86_400_000).toISOString(), to: to.toISOString() });
          setRollingDays(days);
        }} onApply={(range) => { setFilter(range); setRollingDays(undefined); }} />
        <p className="text-xs leading-relaxed text-muted-foreground">Accounts and workflows show current totals. The selected date range applies to executions.</p>
      </div>
      <QueryFeedback pending={dashboard.isPending} error={dashboard.isError} loadingText="Loading platform metrics…" errorText="Could not load the dashboard. Please try again." onRetry={() => void dashboard.refetch()} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard title="Total accounts" value={data.users.total} icon={UsersRound} detail={`${data.users.clientsActive} active Clients · ${data.users.clientsInactive} suspended Clients · ${data.users.adminsActive} active ${data.users.adminsActive === 1 ? 'Admin' : 'Admins'}`} />
            <MetricCard title="Total workflows" value={data.workflows.total} icon={Workflow} detail={`${data.workflows.active} active · ${data.workflows.DRAFT} drafts · ${data.workflows.PUBLISHED} published · ${data.workflows.ARCHIVED} archived`} />
            <MetricCard title="Total executions" value={Object.values(data.executions).reduce((sum, count) => sum + count, 0)} icon={Activity} detail="Across the selected date range" />
            <MetricCard title="Success rate" value={data.successRate === null ? 'No data' : `${data.successRate.toFixed(1)}%`} icon={CircleCheck} detail="Succeeded / (succeeded + failed)" />
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <ExecutionTrend data={data} />
            <ExecutionStatus data={data} />
          </div>
          <ExecutionErrors data={data} />
        </>
      )}
    </>
  );
}
