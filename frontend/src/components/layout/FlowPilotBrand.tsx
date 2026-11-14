import { Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FlowPilotBrand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 font-semibold text-foreground transition-opacity hover:opacity-80">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Workflow className="size-4" />
      </span>
      <span className="text-base font-semibold tracking-tight">FlowPilot</span>
      <span className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
        v1.0
      </span>
    </Link>
  );
}
