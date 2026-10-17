import { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type {
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
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        onSelectionChange={(params) => {
          if (params.nodes.length > 0) {
            setSelectedNodeId(params.nodes[0].id);
          } else {
            setSelectedNodeId(null);
          }
        }}
        fitView
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasContent {...props} />
    </ReactFlowProvider>
  );
}
