import type { Node } from '@xyflow/react';
import type { ExecutionCanvasNodeData } from '../components/canvas/ExecutionCanvasNode';

export interface RawDefinitionNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: { key?: string; name?: string; config?: Record<string, unknown> };
}

export function mapDefinitionNodeToRunner(
  rawNode: RawDefinitionNode,
  idx: number,
  allEdges: Array<{ source: string; target: string }>,
): Node<ExecutionCanvasNodeData> {
  const key = rawNode.data?.key || rawNode.type || '';
  const label = rawNode.data?.name || rawNode.data?.key || rawNode.id;

  let category = 'Action';
  let iconType: ExecutionCanvasNodeData['iconType'] = 'action';
  let detail = key;

  if (
    key.startsWith('trigger.') ||
    key.endsWith('.trigger') ||
    key.includes('webhook') ||
    key.includes('manual')
  ) {
    category = 'Trigger';
    iconType = 'webhook';
    detail = key;
  } else if (key.startsWith('logic.') || key.includes('filter')) {
    category = 'Logic';
    iconType = 'filter';
    detail = rawNode.data?.config?.field
      ? `${String(rawNode.data.config.field)} ${String(rawNode.data?.config?.operator || '==')} ${String(rawNode.data?.config?.value || '')}`
      : 'amount >= 50';
  } else if (key.includes('postgres') || key.includes('db') || key.includes('sql') || key.includes('sheet')) {
    category = 'Action';
    iconType = 'database';
    detail = key.includes('sheet') ? 'readRows()' : 'INSERT orders';
  } else if (key.includes('mail') || key.includes('gmail')) {
    category = 'Action';
    iconType = 'mail';
    detail = 'sendMail()';
  }

  const hasTarget = allEdges.some((e) => e.target === rawNode.id);
  const hasSource = allEdges.some((e) => e.source === rawNode.id);

  return {
    id: rawNode.id,
    type: 'runnerNode',
    position: rawNode.position || { x: 40 + idx * 240, y: 120 },
    data: {
      label,
      category,
      iconType,
      detail,
      status: 'idle',
      hasTarget,
      hasSource,
    },
  };
}

