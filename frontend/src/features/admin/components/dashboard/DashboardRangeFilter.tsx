import { useState, type FormEvent } from 'react';
import { CalendarRange, Clock3 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DashboardFilter } from '@/features/admin/types/admin.types';
import { formatDateTime, localDateTimeInput } from '@/features/admin/utils/format';

interface DashboardRangeFilterProps {
  filter: DashboardFilter;
  rollingDays?: number;
  updatedAt?: string;
  onPreset: (days: number) => void;
  onApply: (filter: DashboardFilter) => void;
}

export function DashboardRangeFilter({ filter, rollingDays, updatedAt, onPreset, onApply }: DashboardRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => localDateTimeInput(new Date(filter.from)));
  const [to, setTo] = useState(() => localDateTimeInput(new Date(filter.to)));
  const [validation, setValidation] = useState('');

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = new Date(from);
    const end = new Date(to);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() - start.getTime() > 90 * 86_400_000) {
      setValidation('Choose a valid date range of up to 90 days.');
      return;
    }
    onApply({ ...filter, from: start.toISOString(), to: end.toISOString() });
    setOpen(false);
    setValidation('');
  }

  return (
    <>
      <Card className="overflow-hidden shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-medium"><CalendarRange className="size-4 text-muted-foreground" />Execution activity</span>
            <div role="group" aria-label="Execution date range" className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {[{ label: '24 hours', days: 1 }, { label: '7 days', days: 7 }, { label: '30 days', days: 30 }].map((preset) => (
                <Button key={preset.days} size="sm" variant={rollingDays === preset.days ? 'default' : 'ghost'} aria-pressed={rollingDays === preset.days} className="h-7 px-3 text-xs" onClick={() => onPreset(preset.days)}>{preset.label}</Button>
              ))}
            </div>
          </div>
          <Button variant={rollingDays === undefined ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => {
            setFrom(localDateTimeInput(new Date(filter.from)));
            setTo(localDateTimeInput(new Date(filter.to)));
            setValidation('');
            setOpen(true);
          }}><CalendarRange className="size-3.5" />Custom range</Button>
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
          <span>{formatDateTime(filter.from)} – {formatDateTime(filter.to)} <span className="mx-1">·</span> {filter.timezone}</span>
          {updatedAt && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3" />Updated {formatDateTime(updatedAt)}</span>}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={applyRange} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Custom date range</DialogTitle>
              <DialogDescription>Select up to 90 days of execution activity. The end time is excluded.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2"><Label htmlFor="dashboard-from">From</Label><Input id="dashboard-from" type="datetime-local" required value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="dashboard-to">To</Label><Input id="dashboard-to" type="datetime-local" required value={to} onChange={(event) => setTo(event.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Time zone: {filter.timezone}</p>
            {validation && <Alert variant="destructive"><AlertDescription>{validation}</AlertDescription></Alert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Apply range</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
