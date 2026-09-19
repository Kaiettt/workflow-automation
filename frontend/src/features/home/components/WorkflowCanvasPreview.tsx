import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  Webhook, 
  GitFork, 
  Database, 
  Mail, 
  Play, 
  RotateCcw, 
  ArrowRight,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Terminal,
  FileCode2,
  ChevronDown,
  ChevronUp,
  X,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- Custom Interactive Node ---
interface PreviewNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  iconType: 'webhook' | 'filter' | 'database' | 'mail';
  detail: string;
  status: 'idle' | 'running' | 'success';
  hasTarget: boolean;
  hasSource: boolean;
  outputSummary?: string;
}

const PreviewNodeComponent: React.FC<NodeProps<Node<PreviewNodeData>>> = ({ data }) => {
  const getIcon = () => {
    switch (data.iconType) {
      case 'webhook': return <Webhook className="size-4 text-indigo-500" />;
      case 'filter': return <GitFork className="size-4 text-amber-500" />;
      case 'database': return <Database className="size-4 text-blue-500" />;
      case 'mail': return <Mail className="size-4 text-emerald-500" />;
    }
  };

  const getStatusBorder = () => {
    if (data.status === 'running') return 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-indigo-500/20';
    if (data.status === 'success') return 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10';
    return 'border-border hover:border-border/80';
  };

  return (
    <div className={`relative min-w-[190px] rounded-xl border bg-card p-3 shadow-md transition-all duration-300 ${getStatusBorder()}`}>
      {data.hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-3 !bg-zinc-400 !border-2 !border-card dark:!bg-zinc-600"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-xs font-semibold text-foreground">{data.label}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">{data.category}</span>
      </div>

      {/* Body */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
            {data.detail}
          </span>
          {data.status === 'running' && (
            <Loader2 className="size-3 text-indigo-500 animate-spin ml-1" />
          )}
          {data.status === 'success' && (
            <CheckCircle2 className="size-3.5 text-emerald-500 ml-1" />
          )}
        </div>

        {/* Live Mini Output Pill */}
        {data.outputSummary && data.status === 'success' && (
          <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
            <Check className="size-2.5" />
            <span className="truncate">{data.outputSummary}</span>
          </div>
        )}
      </div>

      {data.hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-3 !bg-indigo-500 !border-2 !border-card"
        />
      )}
    </div>
  );
};

const nodeTypes = {
  previewNode: PreviewNodeComponent,
};

// Initial Nodes
const INITIAL_NODES: Node<PreviewNodeData>[] = [
  {
    id: 'node-1',
    type: 'previewNode',
    position: { x: 20, y: 120 },
    data: {
      label: 'Webhook',
      category: 'Trigger',
      iconType: 'webhook',
      detail: 'POST /v1/orders',
      status: 'idle',
      hasTarget: false,
      hasSource: true,
    },
  },
  {
    id: 'node-2',
    type: 'previewNode',
    position: { x: 250, y: 120 },
    data: {
      label: 'Filter',
      category: 'Logic',
      iconType: 'filter',
      detail: 'amount >= 50',
      status: 'idle',
      hasTarget: true,
      hasSource: true,
    },
  },
  {
    id: 'node-3',
    type: 'previewNode',
    position: { x: 480, y: 120 },
    data: {
      label: 'PostgreSQL',
      category: 'Action',
      iconType: 'database',
      detail: 'INSERT orders',
      status: 'idle',
      hasTarget: true,
      hasSource: true,
    },
  },
  {
    id: 'node-4',
    type: 'previewNode',
    position: { x: 710, y: 120 },
    data: {
      label: 'Gmail',
      category: 'Action',
      iconType: 'mail',
      detail: 'sendMail()',
      status: 'idle',
      hasTarget: true,
      hasSource: false,
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'e2-3', source: 'node-2', target: 'node-3', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'e3-4', source: 'node-3', target: 'node-4', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } },
];

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success';
  node: string;
  message: string;
}

interface WorkflowCanvasPreviewProps {
  onOpenInDesigner?: (nodes: Node[], edges: Edge[]) => void;
  loading?: boolean;
}

const WorkflowCanvasInner: React.FC<WorkflowCanvasPreviewProps> = ({
  onOpenInDesigner,
  loading,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PreviewNodeData>>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [activeTab, setActiveTab] = useState<'receipt' | 'logs' | 'payload'>('receipt');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    timerRef.current.forEach((t) => clearTimeout(t));
    timerRef.current = [];
  }, []);

  const addLog = (node: string, message: string, level: 'info' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, { timestamp: time, level, node, message }]);
  };

  // Run Test Simulation
  const handleTestRun = useCallback(() => {
    if (isSimulating) return;
    clearAllTimers();
    setIsSimulating(true);
    setShowConsole(true);
    setLogs([]);
    setActiveTab('logs');

    // Reset nodes & edges
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, status: 'idle', outputSummary: undefined },
      }))
    );
    setEdges((eds) => eds.map((e) => ({ ...e, animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } })));

    addLog('System', 'Starting execution #run_8f91a2...', 'info');

    // Step 1: Webhook
    const t1 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === 'node-1'
            ? { ...n, data: { ...n.data, status: 'running', outputSummary: 'Receiving HTTP POST' } }
            : n
        )
      );
      setEdges((eds) => eds.map((e) => (e.id === 'e1-2' ? { ...e, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } : e)));
      addLog('Webhook', 'Inbound POST /v1/orders matched from IP 198.51.100.4', 'info');
      addLog('Webhook', 'Payload: { orderId: "ORD-9421", amount: 149.00, customer: "alex@acme.inc" }', 'success');
    }, 200);

    // Step 2: Filter
    const t2 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === 'node-1') return { ...n, data: { ...n.data, status: 'success', outputSummary: 'ORD-9421 ($149)' } };
          if (n.id === 'node-2') return { ...n, data: { ...n.data, status: 'running', outputSummary: 'Evaluating...' } };
          return n;
        })
      );
      setEdges((eds) => eds.map((e) => (e.id === 'e2-3' ? { ...e, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } : e)));
      addLog('Filter', 'Evaluating condition: payload.amount ($149.00) >= $50.00', 'info');
      addLog('Filter', 'Condition PASSED (Routing to PostgreSQL action)', 'success');
    }, 900);

    // Step 3: PostgreSQL
    const t3 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === 'node-2') return { ...n, data: { ...n.data, status: 'success', outputSummary: 'Condition: TRUE' } };
          if (n.id === 'node-3') return { ...n, data: { ...n.data, status: 'running', outputSummary: 'Executing SQL...' } };
          return n;
        })
      );
      setEdges((eds) => eds.map((e) => (e.id === 'e3-4' ? { ...e, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } : e)));
      addLog('PostgreSQL', 'Query: INSERT INTO "orders" (id, amount, status) VALUES ($1, $2, $3)', 'info');
      addLog('PostgreSQL', '1 row inserted into "orders" table in 8ms', 'success');
    }, 1700);

    // Step 4: Gmail
    const t4 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === 'node-3') return { ...n, data: { ...n.data, status: 'success', outputSummary: 'Inserted (8ms)' } };
          if (n.id === 'node-4') return { ...n, data: { ...n.data, status: 'running', outputSummary: 'Sending email...' } };
          return n;
        })
      );
      addLog('Gmail', 'Connecting to SMTP server (smtp.gmail.com:587)...', 'info');
      addLog('Gmail', 'Delivered receipt email to alex@acme.inc with Message-ID <9a8f2@mail.flowpilot.local>', 'success');
    }, 2500);

    // Finish & switch to receipt view
    const t5 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === 'node-4' ? { ...n, data: { ...n.data, status: 'success', outputSummary: 'Sent to Alex' } } : n
        )
      );
      setIsSimulating(false);
      setActiveTab('receipt');
      addLog('System', 'Pipeline execution #run_8f91a2 finished in 28ms (4/4 nodes successful)', 'success');
    }, 3200);

    timerRef.current = [t1, t2, t3, t4, t5];
  }, [isSimulating, clearAllTimers, setNodes, setEdges]);

  // Reset
  const handleReset = useCallback(() => {
    clearAllTimers();
    setIsSimulating(false);
    setShowConsole(false);
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setLogs([]);
  }, [clearAllTimers, setNodes, setEdges]);

  // Handle Open in Designer
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
        {/* File / Status */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="font-semibold text-foreground">order_fulfillment.flow</span>
          <span className="text-border">/</span>
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            Interactive Demo
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Test Run Button */}
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

          {/* Toggle Console Button */}
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

          {/* Reset Button */}
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

          {/* Open in Designer Button */}
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

        {/* Quick Hint when console is closed */}
        {!showConsole && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-3 py-1.5 shadow-md backdrop-blur text-xs font-mono text-muted-foreground z-10">
            <span className="size-2 rounded-full bg-indigo-500" />
            <span>Click &quot;Test Run&quot; above to see real pipeline results</span>
          </div>
        )}
      </div>

      {/* --- Fun Tangible Output & Execution Drawer --- */}
      {showConsole && (
        <div className="border-t border-border bg-card/95 backdrop-blur transition-all duration-300">
          
          {/* Drawer Tabs */}
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

          {/* Drawer Body */}
          <div className="p-4 max-h-56 overflow-y-auto font-mono text-xs">
            
            {/* Tab 1: Simulated Email & DB Receipt */}
            {activeTab === 'receipt' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Email Delivery Preview */}
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

                {/* PostgreSQL Inserted Record */}
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

            {/* Tab 2: Live Execution Logs */}
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

            {/* Tab 3: Raw JSON Payload */}
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
