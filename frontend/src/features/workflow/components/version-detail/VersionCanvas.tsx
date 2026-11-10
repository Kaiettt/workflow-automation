import React from 'react';
import { Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ExecutionCanvasNode,
  type ExecutionCanvasNodeData,
} from '../canvas/ExecutionCanvasNode';

interface VersionCanvasProps {
  workflowId: string;
  versionNumber: number | string;
  nodes: Node<ExecutionCanvasNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<ExecutionCanvasNodeData>>;
  onEdgesChange: OnEdgesChange;
}

const nodeTypes = {
  runnerNode: ExecutionCanvasNode,
  default: ExecutionCanvasNode,
};

export const VersionCanvas: React.FC<VersionCanvasProps> = ({
  workflowId,
  versionNumber,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}) => {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-left">
      {/* Canvas Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border px-4 py-2.5 bg-muted/40 gap-3">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="font-semibold text-foreground">
            workflow_v{versionNumber}.flow
          </span>
          <span className="text-border">/</span>
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            Live Runner Canvas
          </span>
          <span className="text-muted-foreground text-[10px] hidden sm:inline">
            ({nodes.length} nodes, {edges.length} edges)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/workflows/${workflowId}`}>
            <Button
              variant="default"
              size="sm"
              className="h-8 rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium px-3 gap-1.5"
            >
              <ExternalLink className="size-3.5" />
              <span>Open in Designer</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="relative h-[340px] w-full bg-background">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.5}
            maxZoom={1.5}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background color="var(--border)" gap={20} size={1} />
            <Controls
              showInteractive={false}
              className="!bg-card !border-border !shadow-sm !rounded-lg"
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

