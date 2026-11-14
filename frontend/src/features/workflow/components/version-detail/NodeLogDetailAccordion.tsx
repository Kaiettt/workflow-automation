import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface NodeLogDetailAccordionProps {
  errorMessage?: string | null;
  input: unknown;
  output: unknown;
}

export const NodeLogDetailAccordion: React.FC<NodeLogDetailAccordionProps> = ({
  errorMessage,
  input,
  output,
}) => {
  return (
    <div className="p-4 space-y-3">
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-bold">Execution error</AlertTitle>
          <AlertDescription className="text-xs font-mono break-all mt-1">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-muted-foreground font-semibold mb-1 text-[11px] uppercase tracking-wider">
            Input Data
          </div>
          <pre className="max-h-48 overflow-auto text-[11px] text-foreground p-2 rounded bg-muted/40">
            {JSON.stringify(input, null, 2) ?? 'null'}
          </pre>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-muted-foreground font-semibold mb-1 text-[11px] uppercase tracking-wider">
            Output Data
          </div>
          <pre className="max-h-48 overflow-auto text-[11px] text-foreground p-2 rounded bg-muted/40">
            {JSON.stringify(output, null, 2) ?? 'null'}
          </pre>
        </div>
      </div>
    </div>
  );
};

