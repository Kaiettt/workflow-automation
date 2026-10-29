import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNodeWebhooks } from '../../hooks/useWorkflowTriggers';
import { triggerService } from '../../services/trigger.service';
import { FieldShell } from './FieldShell';

interface WebhookUrlFieldProps {
  workflowId: string;
  nodeId: string;
}

// Read-only URL of a webhook trigger node; it exists as soon as the node is
// saved in the draft and stays the same across publishes.
export function WebhookUrlField({ workflowId, nodeId }: WebhookUrlFieldProps) {
  const { data: webhooks, isLoading } = useNodeWebhooks(workflowId, nodeId);
  const [copied, setCopied] = useState(false);
  const url = triggerService.findForNode(webhooks, nodeId)?.url ?? null;

  const copy = () => {
    if (!url) return;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  const hint = url
    ? 'Receives POST requests while the workflow is Active, or while listening for a test event.'
    : isLoading
      ? 'Loading…'
      : 'The URL appears once the draft is saved.';

  return (
    <FieldShell id="webhook-url" label="Webhook URL" hint={hint}>
      <div className="flex gap-2">
        <Input
          id="webhook-url"
          readOnly
          value={url ?? ''}
          placeholder="Saving…"
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          disabled={!url}
          aria-label="Copy webhook URL"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </FieldShell>
  );
}
