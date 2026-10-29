import { useState } from 'react';
import { Check, Copy, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkflowTriggers } from '../hooks/useWorkflowTriggers';
import { triggerService } from '../services/trigger.service';

interface WebhookTriggerInfoProps {
  workflowId: string;
  versionId: string;
  nodeId: string;
}

// Shown instead of the Run button: a webhook version runs when its URL is called.
export function WebhookTriggerInfo({ workflowId, versionId, nodeId }: WebhookTriggerInfoProps) {
  const { data: triggers, isLoading } = useWorkflowTriggers(workflowId);
  const [copied, setCopied] = useState(false);
  const trigger = triggerService.findForNode(triggers, nodeId);
  const isCurrent = trigger?.workflowVersionId === versionId;
  const url = isCurrent ? trigger?.webhookUrl : null;

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

  return (
    <div className="w-full max-w-md space-y-2 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Webhook className="size-4 text-primary" />
        Chạy khi có request tới Webhook
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Đang tải URL…</p>
      ) : url ? (
        <>
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              aria-label="Webhook URL"
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label="Sao chép Webhook URL"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Gửi <code className="font-mono">POST</code> kèm JSON tới URL này; workflow chạy nền và kết
            quả nằm trong lịch sử thực thi.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Chỉ phiên bản đang chạy (bản publish mới nhất) nhận webhook. Phiên bản này không nhận request.
        </p>
      )}
    </div>
  );
}
