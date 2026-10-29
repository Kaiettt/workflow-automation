import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkflowTriggers } from '../../hooks/useWorkflowTriggers';
import { triggerService } from '../../services/trigger.service';
import { FieldShell } from './FieldShell';

interface WebhookUrlFieldProps {
  workflowId: string;
  nodeId: string;
}

// Read-only: the URL is created when the workflow is published.
export function WebhookUrlField({ workflowId, nodeId }: WebhookUrlFieldProps) {
  const { data: triggers, isLoading } = useWorkflowTriggers(workflowId, nodeId);
  const [copied, setCopied] = useState(false);
  const url = triggerService.findForNode(triggers, nodeId)?.webhookUrl ?? null;

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
    ? 'POST JSON to this URL to run the published version. It stays the same when you publish again.'
    : isLoading
      ? 'Loading…'
      : 'Publish the workflow to get its URL.';

  return (
    <FieldShell id="webhook-url" label="Webhook URL" hint={hint}>
      <div className="flex gap-2">
        <Input
          id="webhook-url"
          readOnly
          value={url ?? ''}
          placeholder="Not published yet"
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
