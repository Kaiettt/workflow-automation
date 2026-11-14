import { ChartColumn, CircleCheck, CircleX, ListFilter } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Dashboard } from '@/features/admin/types/admin.types';
import { executionChartConfig, executionTrendPoints, formatChartDay } from '@/features/admin/utils/execution-chart';

interface ExecutionPanelProps {
  data: Dashboard;
}

export function ExecutionTrend({ data }: ExecutionPanelProps) {
  const points = executionTrendPoints(data.trend);
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-5 pb-4">
        <div className="space-y-1.5"><CardTitle className="text-sm">Execution trend</CardTitle><CardDescription className="text-xs">Daily executions by status</CardDescription></div>
        <ChartColumn className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {points.length ? (
          <ChartContainer config={executionChartConfig} className="h-64 w-full aspect-auto sm:h-72" aria-label="Daily execution trend">
            <BarChart data={points} accessibilityLayer margin={{ top: 12, right: 4, left: -12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={formatChartDay} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => formatChartDay(String(label))} />} />
              <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 pt-4 text-[11px]" />} />
              {Object.keys(executionChartConfig).map((status) => <Bar key={status} dataKey={status} stackId="execution" fill={`var(--color-${status})`} maxBarSize={40} isAnimationActive={false} />)}
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center sm:h-72">
            <ChartColumn className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No executions in the selected date range.</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">Choose a different range to see execution activity.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecutionStatus({ data }: ExecutionPanelProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-5 pb-4">
        <div className="space-y-1.5"><CardTitle className="text-sm">Execution status</CardTitle><CardDescription className="text-xs">Breakdown for the selected range</CardDescription></div>
        <ListFilter className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <dl className="divide-y divide-border">
          {Object.entries(executionChartConfig).map(([status, config]) => (
            <div key={status} className="flex items-center justify-between py-4 first:pt-1 last:pb-0">
              <dt className="flex items-center gap-2.5 text-xs text-muted-foreground"><span className="size-2 rounded-full" style={{ backgroundColor: config.color }} />{config.label}</dt>
              <dd className="font-mono text-sm font-medium tabular-nums">{(data.executions[status] ?? 0).toLocaleString('en-US')}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function ExecutionErrors({ data }: ExecutionPanelProps) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-5">
        <div className="space-y-1.5"><CardTitle className="text-sm">Execution errors</CardTitle><CardDescription className="text-xs">Failed executions grouped by error code</CardDescription></div>
        <Badge variant="outline" className="font-normal">{data.errors.length} error {data.errors.length === 1 ? 'type' : 'types'}</Badge>
      </CardHeader>
      {data.errors.length ? (
        <Table>
          <TableHeader className="bg-muted/30"><TableRow className="hover:bg-transparent"><TableHead className="px-5 text-xs">Error code</TableHead><TableHead className="px-5 text-right text-xs">Failed executions</TableHead></TableRow></TableHeader>
          <TableBody>{data.errors.map((error) => <TableRow key={error.code}><TableCell className="px-5 py-3.5"><span className="inline-flex items-center gap-2 font-mono text-xs"><CircleX className="size-3.5 text-destructive" />{error.code}</span></TableCell><TableCell className="px-5 text-right font-mono text-xs tabular-nums">{error.count.toLocaleString('en-US')}</TableCell></TableRow>)}</TableBody>
        </Table>
      ) : (
        <CardContent className="flex flex-col items-center gap-2 border-t border-border bg-muted/10 p-8 text-center">
          <CircleCheck className="mb-1 size-6 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium">No execution errors</p>
          <p className="text-xs text-muted-foreground">No failed executions in the selected date range.</p>
        </CardContent>
      )}
    </Card>
  );
}
