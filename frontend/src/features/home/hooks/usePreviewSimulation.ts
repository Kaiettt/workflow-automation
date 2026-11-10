import { useState, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { ExecutionCanvasNodeData } from '../../workflow/components/canvas/ExecutionCanvasNode';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success';
  node: string;
  message: string;
}

export const INITIAL_PREVIEW_NODES: Node<ExecutionCanvasNodeData>[] = [
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

export const INITIAL_PREVIEW_EDGES: Edge[] = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'e2-3', source: 'node-2', target: 'node-3', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'e3-4', source: 'node-3', target: 'node-4', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } },
];

export function usePreviewSimulation() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ExecutionCanvasNodeData>>(INITIAL_PREVIEW_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_PREVIEW_EDGES);
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
      })),
    );
    setEdges((eds) =>
      eds.map((e) => ({ ...e, animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } })),
    );

    addLog('System', 'Starting execution #run_8f91a2...', 'info');

    // Step 1: Webhook
    const t1 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === 'node-1'
            ? { ...n, data: { ...n.data, status: 'running', outputSummary: 'Receiving HTTP POST' } }
            : n,
        ),
      );
      setEdges((eds) =>
        eds.map((e) => (e.id === 'e1-2' ? { ...e, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } : e)),
      );
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
        }),
      );
      setEdges((eds) =>
        eds.map((e) => (e.id === 'e2-3' ? { ...e, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } : e)),
      );
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
        }),
      );
      setEdges((eds) =>
        eds.map((e) => (e.id === 'e3-4' ? { ...e, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } : e)),
      );
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
        }),
      );
      addLog('Gmail', 'Connecting to SMTP server (smtp.gmail.com:587)...', 'info');
      addLog('Gmail', 'Delivered receipt email to alex@acme.inc with Message-ID <9a8f2@mail.flowpilot.local>', 'success');
    }, 2500);

    // Finish & switch to receipt view
    const t5 = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === 'node-4' ? { ...n, data: { ...n.data, status: 'success', outputSummary: 'Sent to Alex' } } : n,
        ),
      );
      setIsSimulating(false);
      setActiveTab('receipt');
      addLog('System', 'Pipeline execution #run_8f91a2 finished in 28ms (4/4 nodes successful)', 'success');
    }, 3200);

    timerRef.current = [t1, t2, t3, t4, t5];
  }, [isSimulating, clearAllTimers, setNodes, setEdges]);

  const handleReset = useCallback(() => {
    clearAllTimers();
    setIsSimulating(false);
    setShowConsole(false);
    setNodes(INITIAL_PREVIEW_NODES);
    setEdges(INITIAL_PREVIEW_EDGES);
    setLogs([]);
  }, [clearAllTimers, setNodes, setEdges]);

  return {
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
  };
}

