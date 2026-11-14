import type { ChartConfig } from '@/components/ui/chart';
import type { Dashboard } from '@/features/admin/types/admin.types';

export const executionChartConfig = {
  SUCCESS: { label: 'Succeeded', color: 'var(--primary)' },
  FAILED: { label: 'Failed', color: 'var(--destructive)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--muted-foreground)' },
  RUNNING: { label: 'Running', color: '#3b82f6' },
  QUEUED: { label: 'Queued', color: '#f59e0b' },
} satisfies ChartConfig;

interface ExecutionTrendPoint {
  day: string;
  SUCCESS: number;
  FAILED: number;
  CANCELLED: number;
  RUNNING: number;
  QUEUED: number;
}

function isExecutionStatus(status: string): status is keyof typeof executionChartConfig {
  return Object.hasOwn(executionChartConfig, status);
}

export function executionTrendPoints(trend: Dashboard['trend']) {
  const rows = new Map<string, ExecutionTrendPoint>();
  for (const row of trend) {
    const point = rows.get(row.day) ?? { day: row.day, SUCCESS: 0, FAILED: 0, CANCELLED: 0, RUNNING: 0, QUEUED: 0 };
    if (isExecutionStatus(row.status)) point[row.status] += row.count;
    rows.set(row.day, point);
  }
  return [...rows.values()].sort((left, right) => left.day.localeCompare(right.day));
}

export function formatChartDay(day: string) {
  return new Date(`${day.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
