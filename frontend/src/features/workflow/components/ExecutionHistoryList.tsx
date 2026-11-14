import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ExecutionHistoryItem } from '../types/execution.types';

interface ExecutionHistoryListProps {
  executions: ExecutionHistoryItem[];
  selectedId: string | null;
  onSelect: (executionId: string) => void;
}

export function ExecutionHistoryList({
  executions,
  selectedId,
  onSelect,
}: ExecutionHistoryListProps) {
  return (
    <section aria-labelledby="execution-history-heading">
      <h2 id="execution-history-heading" className="text-sm font-semibold">
        Execution history
      </h2>
      {executions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No executions yet.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {executions.map((execution) => {
            const timestamp = execution.queuedAt ?? execution.startedAt;
            return (
              <li key={execution.id}>
                <Button
                  type="button"
                  variant={selectedId === execution.id ? 'secondary' : 'outline'}
                  size="sm"
                  aria-label={`Execution ${execution.id}, ${execution.status}`}
                  aria-pressed={selectedId === execution.id}
                  onClick={() => onSelect(execution.id)}
                  className="h-auto justify-between gap-3 py-2"
                >
                  <span className="flex flex-col items-start">
                    <span className="font-mono text-xs">{execution.id}</span>
                    {timestamp && (
                      <time
                        dateTime={timestamp}
                        className="text-[11px] text-muted-foreground"
                      >
                        {new Date(timestamp).toLocaleString('en-US')}
                      </time>
                    )}
                  </span>
                  <Badge variant="outline">{execution.status}</Badge>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
