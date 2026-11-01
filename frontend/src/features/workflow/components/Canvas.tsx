import { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  Controls,
  MiniMap,
  addEdge,
  useReactFlow,
} from '@xyflow/react';
import type {
  DefaultEdgeOptions,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { useDesignerStore } from '../store/designer.store';
import { getDefaultConfig, uniqueNodeName } from '../utils/node-config';
import { outputOfHandle, resolveOutputs } from '../utils/node-outputs';

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

function CanvasContent({ nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges }: CanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const setSelectedNodeId = useDesignerStore((state) => state.setSelectedNodeId);
  const catalogNodeTypes = useDesignerStore((state) => state.nodeTypes);

  // Edges look the same whether new or saved: smooth step, arrow at the end.
  const defaultEdgeOptions = useMemo<DefaultEdgeOptions>(
    () => ({
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 18, height: 18 },
    }),
    [],
  );
  const miniMapColor = useCallback(
    (node: Node) =>
      (Array.isArray(catalogNodeTypes) &&
        catalogNodeTypes.find((nt) => nt.key === node.data?.key)?.color) ||
      '#94a3b8',
    [catalogNodeTypes],
  );

  // Edges leaving a named output show its name (not saved, only drawn).
  const labelledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const key = outputOfHandle(edge.sourceHandle);
        if (key === null) return edge;
        const source = nodes.find((node) => node.id === edge.source);
        const schema = Array.isArray(catalogNodeTypes)
          ? catalogNodeTypes.find((nt) => nt.key === source?.data?.key)?.configSchema
          : undefined;
        const label = resolveOutputs(schema, source?.data?.config).find((o) => o.key === key)?.label;
        return label
          ? {
              ...edge,
              label,
              labelStyle: { fontSize: 10, fill: '#475569' },
              labelBgStyle: { fill: '#f8fafc' },
              labelBgPadding: [4, 2] as [number, number],
            }
          : edge;
      }),
    [edges, nodes, catalogNodeTypes],
  );

  const nodeTypes = useMemo<NodeTypes>(() => {
    const map: NodeTypes = {
      default: ActionNode,
      triggerNode: TriggerNode,
      actionNode: ActionNode,
      'trigger.manual': TriggerNode,
      'logic.filter': ActionNode,
      'integration.gmail.send': ActionNode,
      'integration.slack.post_message': ActionNode,
    };

    if (Array.isArray(catalogNodeTypes)) {
      for (const nt of catalogNodeTypes) {
        if (nt.category === 'TRIGGER' || nt.key.startsWith('trigger.')) {
          map[nt.key] = TriggerNode;
        } else {
          map[nt.key] = ActionNode;
        }
      }
    }
    return map;
  }, [catalogNodeTypes]);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const name = event.dataTransfer.getData('application/reactflow/name');
      const key = event.dataTransfer.getData('application/reactflow/key');

      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const catalogNode = Array.isArray(catalogNodeTypes)
        ? catalogNodeTypes.find((nt) => nt.key === key)
        : undefined;

      setNodes((nds) => {
        const newNode: Node = {
          id: `${type}-${Date.now()}`,
          type,
          position,
          data: {
            name: uniqueNodeName(
              name,
              nds.map((node) => String(node.data?.name ?? '')),
            ),
            key,
            config: getDefaultConfig(catalogNode?.configSchema),
          },
        };
        return nds.concat(newNode);
      });
    },
    [screenToFlowPosition, setNodes, catalogNodeTypes]
  );

  return (
    <div className="flex-1 h-full w-full bg-gray-50 relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={labelledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onSelectionChange={(params) => {
          if (params.nodes.length > 0) {
            setSelectedNodeId(params.nodes[0].id);
          } else {
            setSelectedNodeId(null);
          }
        }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={20} size={1.5} />
        <Controls showInteractive={false} />
        <MiniMap
          zoomable
          pannable
          nodeColor={miniMapColor}
          nodeStrokeWidth={0}
          nodeBorderRadius={4}
          maskColor="rgba(241, 245, 249, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return <CanvasContent {...props} />;
}
