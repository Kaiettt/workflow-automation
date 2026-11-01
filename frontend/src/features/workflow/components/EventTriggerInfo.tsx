import { Zap } from 'lucide-react';
import { useActivation, useNodeWebhooks } from '../hooks/useWorkflowTriggers';

interface EventTriggerInfoProps {
  workflowId: string;
  versionId: string;
  triggerName: string;
}

// Shown instead of the Run button: a version with an event trigger runs by
// itself while the workflow is Active, and only the current version does.
export function EventTriggerInfo({ workflowId, versionId, triggerName }: EventTriggerInfoProps) {
  const { data: state, isLoading } = useActivation(workflowId);
  const { data: webhooks = [] } = useNodeWebhooks(workflowId);
  const listening = state?.active && state.versionId === versionId;
  const urls = webhooks.filter((webhook) => webhook.scope === 'node' && webhook.url);

  return (
    <div className="w-full max-w-md space-y-2 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Zap className="size-4 text-primary" />
        Tự chạy khi “{triggerName}” nhận sự kiện
      </div>
      <p className="text-xs text-muted-foreground">
        {isLoading
          ? 'Đang tải…'
          : listening
            ? 'Phiên bản này đang lắng nghe (workflow đang Active).'
            : state?.active
              ? 'Workflow đang Active bằng một phiên bản khác; phiên bản này không nhận sự kiện.'
              : 'Workflow đang tắt. Bật công tắc Active trong Designer để bắt đầu lắng nghe.'}
      </p>
      {listening &&
        urls.map((webhook) => (
          <code key={webhook.nodeId} className="block truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
            {webhook.url}
          </code>
        ))}
    </div>
  );
}
