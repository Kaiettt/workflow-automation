import { useEffect, useState } from 'react';
import { Loader2, Radio, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTestListen } from '../hooks/useWorkflowTriggers';

interface TestEventPanelProps {
  workflowId: string;
  nodeId: string;
  // The draft has unsaved changes the server would not see yet.
  draftSaving: boolean;
}

// "Listen for test event": waits for one real event with the node's draft
// settings and shows what arrived, so later nodes can be written against it.
export function TestEventPanel({ workflowId, nodeId, draftSaving }: TestEventPanelProps) {
  const { listen, error, starting, start, stop } = useTestListen(workflowId, nodeId);
  const secondsLeft = useSecondsLeft(listen?.status === 'waiting' ? listen.expiresAt : null);

  return (
    <section className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Test event</p>
        {listen?.status === 'waiting' ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void stop()}>
            <Square className="size-3.5" />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void start()}
            disabled={starting || draftSaving}
          >
            {starting ? <Loader2 className="size-3.5 animate-spin" /> : <Radio className="size-3.5" />}
            Listen for test event
          </Button>
        )}
      </div>

      {listen?.status === 'waiting' && (
        <p className="text-xs text-muted-foreground">
          Waiting for an event… ({formatSeconds(secondsLeft)}). Send one now (e.g. message the
          Page). It will not run the workflow.
        </p>
      )}
      {listen?.status === 'expired' && (
        <p className="text-xs text-muted-foreground">No event received in time. Try again.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {listen?.status === 'received' && listen.event && (
        <div className="space-y-1">
          <p className="text-xs text-emerald-700">Event received. Use its fields in later nodes.</p>
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-[11px] leading-snug">
            {JSON.stringify(listen.event, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

function useSecondsLeft(expiresAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000)) : 0;
}

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
