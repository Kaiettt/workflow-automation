import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useActivation, useSetActive } from '../hooks/useWorkflowTriggers';

interface ActiveToggleProps {
  workflowId: string;
}

// The workflow's Active switch: on, its published version listens for events
// (webhooks are registered with the apps); off, nothing listens.
export function ActiveToggle({ workflowId }: ActiveToggleProps) {
  const { data: state, isLoading } = useActivation(workflowId);
  const setActive = useSetActive(workflowId);
  const active = state?.active ?? false;

  return (
    <div className="flex items-center gap-2">
      {setActive.isError && (
        <span
          role="alert"
          title={setActive.error.message}
          className="flex max-w-xs items-center gap-1 truncate text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="truncate">{setActive.error.message}</span>
        </span>
      )}
      {setActive.isPending && (
        <span className="text-xs text-muted-foreground">
          {active ? 'Turning off…' : 'Registering webhooks…'}
        </span>
      )}
      <Label
        htmlFor="workflow-active"
        className={active ? 'text-xs text-emerald-700' : 'text-xs text-muted-foreground'}
      >
        Active
      </Label>
      <Switch
        id="workflow-active"
        checked={active}
        disabled={isLoading || setActive.isPending}
        onCheckedChange={(checked) => setActive.mutate(checked)}
      />
    </div>
  );
}
