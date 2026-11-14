import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PageControlsProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function PageControls({ page, total, pageSize, onChange }: PageControlsProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? Math.min((page - 1) * pageSize + 1, total) : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-5 py-4">
      <span className="text-xs text-muted-foreground">{total ? `Showing ${first.toLocaleString('en-US')}–${last.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} results` : '0 results'}</span>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Page {page} of {pages}</span>
        <Button variant="outline" size="sm" className="text-xs" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="size-3.5" />Previous</Button>
        <Button variant="outline" size="sm" className="text-xs" disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}>Next<ChevronRight className="size-3.5" /></Button>
      </div>
    </div>
  );
}
