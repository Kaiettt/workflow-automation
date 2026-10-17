import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface FieldShellProps {
  id: string;
  label: string;
  expression?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}

// Label, optional "fx" marker (the field accepts expressions) and hint around a control.
export function FieldShell({ id, label, expression, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="capitalize">
          {label}
        </Label>
        {expression && (
          <span className="rounded border border-purple-200 bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] text-purple-700">
            fx
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
