import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Database,
  Mail,
  Play,
  RotateCcw,
  ArrowRight,
  Loader2,
  ExternalLink,
  Terminal,
  FileCode2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExecutionCanvasNode } from '../../workflow/components/canvas/ExecutionCanvasNode';
import { usePreviewSimulation } from '../hooks/usePreviewSimulation';

const nodeTypes = {
  previewNode: ExecutionCanvasNode,
  default: ExecutionCanvasNode,
};

interface WorkflowCanvasPreviewProps {
  onOpenInDesigner?: (nodes: Node[], edges: Edge[]) => void;
  loading?: boolean;
}

const WorkflowCanvasInner: React.FC<WorkflowCanvasPreviewProps> = ({
  onOpenInDesigner,
  loading,
}) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    isSimulating,
    showConsole,
    setShowConsole,
    activeTab,
    setActiveTab,
    logs,
    handleTestRun,
    handleReset,
  } = usePreviewSimulation();

  const handleOpenInDesigner = () => {
    if (!onOpenInDesigner) return;
    const designerNodes: Node[] = [
      { id: 'trigger-1', type: 'triggerNode', position: { x: 100, y: 150 }, data: { name: 'Webhook (POST /v1/orders)' } },
      { id: 'action-2', type: 'actionNode', position: { x: 350, y: 150 }, data: { name: 'Filter (amount >= 50)' } },
      { id: 'action-3', type: 'actionNode', position: { x: 600, y: 150 }, data: { name: 'PostgreSQL (INSERT orders)' } },
      { id: 'action-4', type: 'actionNode', position: { x: 850, y: 150 }, data: { name: 'Gmail (sendConfirmation)' } },
    ];
    const designerEdges: Edge[] = [
      { id: 'e1-2', source: 'trigger-1', target: 'action-2' },
      { id: 'e2-3', source: 'action-2', target: 'action-3' },
      { id: 'e3-4', source: 'action-3', target: 'action-4' },
    ];
    onOpenInDesigner(designerNodes, designerEdges);
  };

  return (
    <div id="canvas" className="relative mx-auto w-full max-w-5xl rounded-xl border border-border bg-card shadow-sm overflow-hidden text-left">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border px-4 py-2.5 bg-muted/40 gap-3">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="font-semibold text-foreground">order_fulfillment.flow</span>
          <span className="text-border">/</span>
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            Interactive Demo
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTestRun}
            disabled={isSimulating}
            size="sm"
            className="h-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium px-3 gap-1.5 shadow-sm"
          >
            {isSimulating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
            <span>{isSimulating ? 'Running...' : 'Test Run'}</span>
          </Button>

          {logs.length > 0 && (
            <Button
              onClick={() => setShowConsole(!showConsole)}
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-medium px-2.5 gap-1.5"
            >
              <Terminal className="size-3.5 text-indigo-500" />
              <span>Result</span>
              {showConsole ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
            </Button>
          )}

          <Button
            onClick={handleReset}
            disabled={isSimulating}
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs font-medium px-2.5 gap-1"
            title="Reset layout & state"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          <Button
            onClick={handleOpenInDesigner}
            disabled={loading}
            variant="default"
            size="sm"
            className="h-8 rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium px-3 gap-1.5"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ExternalLink className="size-3.5" />
            )}
            <span>{loading ? 'Opening...' : 'Open in Designer'}</span>
            <ArrowRight className="size-3 hidden sm:inline" />
          </Button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="relative h-[380px] w-full bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={1.5}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background color="var(--border)" gap={20} size={1} />
          <Controls showInteractive={false} className="!bg-card !border-border !shadow-sm !rounded-lg" />
        </ReactFlow>

        {!showConsole && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-3 py-1.5 shadow-md backdrop-blur text-xs font-mono text-muted-foreground z-10">
            <span className="size-2 rounded-full bg-indigo-500" />
            <span>Click &quot;Test Run&quot; above to see real pipeline results</span>
          </div>
        )}
      </div>

      {/* Output & Execution Drawer */}
      {showConsole && (
        <div className="border-t border-border bg-card/95 backdrop-blur transition-all duration-300">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 bg-muted/30">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('receipt')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'receipt'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Mail className="size-3.5 text-emerald-500" />
                <span>Generated Output (Email &amp; DB)</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'logs'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="size-3.5 text-indigo-500" />
                <span>Execution Logs ({logs.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('payload')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'payload'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileCode2 className="size-3.5 text-amber-500" />
                <span>Raw JSON Payload</span>
              </button>
            </div>

            <button
              onClick={() => setShowConsole(false)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title="Close Output Panel"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="p-4 max-h-56 overflow-y-auto font-mono text-xs">
            {activeTab === 'receipt' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-background p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Mail className="size-3.5 text-emerald-500" />
                      <span>Gmail Notification Sent</span>
                    </div>
                    <span className="text-[10px] rounded bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 border border-emerald-500/20">
                      Delivered
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div><strong className="text-foreground">To:</strong> alex@acme.inc</div>
                    <div><strong className="text-foreground">Subject:</strong> Your Order #ORD-9421 is Confirmed!</div>
                  </div>

                  <div className="mt-2 rounded bg-muted/50 p-2.5 text-[11px] text-foreground/90 font-sans border border-border/40">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">Order #ORD-9421 Confirmed</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Hi Alex, we received your payment of <strong className="text-foreground">$149.00</strong>. Your order is being packed.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Database className="size-3.5 text-blue-500" />
                      <span>PostgreSQL Record Stored</span>
                    </div>
                    <span className="text-[10px] rounded bg-blue-500/10 text-blue-600 px-1.5 py-0.5 border border-blue-500/20">
                      1 row inserted (8ms)
                    </span>
                  </div>

                  <div className="rounded bg-zinc-950 p-2 text-zinc-300 text-[11px] overflow-x-auto">
                    <pre>
{`{
  "id": "ORD-9421",
  "customer": "alex@acme.inc",
  "amount": 149.00,
  "status": "PAID",
  "created_at": "${new Date().toISOString()}"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-1 text-zinc-800 dark:text-zinc-200">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                    <span className={`px-1 rounded text-[10px] shrink-0 ${
                      log.level === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {log.node}
                    </span>
                    <span className={log.level === 'success' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'payload' && (
              <div className="rounded bg-zinc-950 p-3 text-zinc-300 text-[11px] overflow-x-auto">
                <pre>
{`// Input Payload received at POST /v1/orders
{
  "event": "order.created",
  "orderId": "ORD-9421",
  "amount": 149.00,
  "currency": "USD",
  "customer": {
    "name": "Alex Mercer",
    "email": "alex@acme.inc",
    "company": "Acme Inc."
  },
  "items": [
    { "sku": "FP-PRO-LICENSE", "qty": 1, "price": 149.00 }
  ],
  "evaluatedRules": {
    "minAmountMet": true,
    "routedTo": ["postgresql.insert", "gmail.sendMail"]
  }
}`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const WorkflowCanvasPreview: React.FC<WorkflowCanvasPreviewProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
