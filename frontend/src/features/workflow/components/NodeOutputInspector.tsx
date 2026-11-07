import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NODE_SAMPLE_OUTPUTS } from '../utils/nodeSampleOutputs';

interface NodeOutputInspectorProps {
  nodeKey: string;
  nodeName: string;
  liveOutput?: Record<string, unknown> | null;
}

export const NodeOutputInspector: React.FC<NodeOutputInspectorProps> = ({
  nodeKey,
  nodeName,
  liveOutput,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<'relative' | 'absolute'>('relative');

  const sampleInfo = NODE_SAMPLE_OUTPUTS[nodeKey];
  const displayData = liveOutput || sampleInfo?.data || {};
  const isLive = Boolean(liveOutput);

  const formatExpression = (field: string) => {
    // If field starts with bracket e.g. ["Field Name"]
    const isBracket = field.startsWith('[');
    if (copyMode === 'relative') {
      return isBracket ? `{{$json${field}}}` : `{{$json.${field}}}`;
    }
    return isBracket
      ? `{{$node["${nodeName}"].json${field}}}`
      : `{{$node["${nodeName}"].json.${field}}}`;
  };

  const [copyMessage, setCopyMessage] = useState('');

  const handleCopy = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setCopyMessage(keyId === 'all-json' ? 'JSON copied.' : 'Expression copied to clipboard.');
      window.setTimeout(() => setCopiedKey(null), 2000);
      window.setTimeout(() => setCopyMessage(''), 3000);
    } catch {
      setCopyMessage('Could not copy. Check your browser clipboard permissions.');
    }
  };

  const jsonString = JSON.stringify(displayData, null, 2);

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Top Status & Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span>Output preview</span>
        </div>
        <Badge
          variant={isLive ? 'default' : 'secondary'}
          className="text-[10px] font-mono px-1.5 py-0"
        >
          {isLive ? 'Live data' : 'Sample data'}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {sampleInfo?.description || 'Data produced by this node when it runs.'}
      </p>

      {/* Mode Selector for Expressions */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">Expression format</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCopyMode('relative')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              copyMode === 'relative'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Current item
          </button>
          <button
            type="button"
            onClick={() => setCopyMode('absolute')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              copyMode === 'absolute'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Named node
          </button>
        </div>
      </div>

      {/* Quick-Copy Chips */}
      {sampleInfo?.shortcuts && sampleInfo.shortcuts.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 font-semibold text-[11px] text-primary">
            <span>Copy an expression for a downstream node</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {sampleInfo.shortcuts.map((sc, i) => {
              const expr = formatExpression(sc.field);
              const isCopied = copiedKey === `sc-${i}`;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => void handleCopy(expr, `sc-${i}`)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-md border border-border/70 bg-card p-2 text-left transition-all hover:border-primary hover:bg-primary/5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={`Click to copy: ${expr}`}
                  aria-label={`Copy ${expr}`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground text-[11px] truncate">
                        {sc.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        = {sc.example}
                      </span>
                    </div>
                    <code className="font-mono text-[10px] text-primary/80 truncate">
                      {expr}
                    </code>
                  </div>
                  <span className="size-6 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true">
                    {isCopied ? 'Copied' : 'Copy'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Formatted JSON Box */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>Output JSON</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleCopy(jsonString, 'all-json')}
            className="h-6 gap-1 text-[10px]"
          >
            {copiedKey === 'all-json' ? 'Copied' : 'Copy JSON'}
          </Button>
        </div>

        <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-100 leading-tight">
          <code>{jsonString}</code>
        </pre>
      </div>

      {copyMessage && <p role="status" aria-live="polite" className="text-[11px] text-muted-foreground">{copyMessage}</p>}
    </div>
  );
};

