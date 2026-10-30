import { MAIN_OUTPUT } from '@app/shared/utils/node-outputs';

export interface WorkflowNode {
  id: string;
  data: { key: string; config?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  [key: string]: unknown;
}

// An output of a node is named by the edge's source handle ("out:<key>");
// edges from the plain side handles of single-output nodes carry the main output.
export { MAIN_OUTPUT };
const OUTPUT_HANDLE_PREFIX = 'out:';

export function edgeOutput(edge: WorkflowEdge): string {
  const handle = edge.sourceHandle;
  return typeof handle === 'string' && handle.startsWith(OUTPUT_HANDLE_PREFIX)
    ? handle.slice(OUTPUT_HANDLE_PREFIX.length)
    : MAIN_OUTPUT;
}

export interface GraphPlan {
  // Node ids that take part in the flow, parents before children.
  order: string[];
  // Edges into each node, in the order they were stored; the start node has none.
  incoming: Map<string, WorkflowEdge[]>;
}

// The edges may be stored in any order (the designer appends them as the user
// draws them), so the order is rebuilt from the graph: one start node, no
// cycles; a node may fan out to several nodes and several nodes may join.
export function buildGraphPlan(definition: unknown): GraphPlan {
  if (!definition || typeof definition !== 'object')
    throw new Error('Workflow definition is invalid');
  const graph = definition as Partial<WorkflowDefinition>;
  if (!Array.isArray(graph.edges) || graph.edges.length === 0)
    throw new Error('Workflow definition must contain a non-empty edge chain');
  if (!Array.isArray(graph.nodes))
    throw new Error('Workflow definition must contain nodes');

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const incoming = new Map<string, WorkflowEdge[]>();
  const outgoing = new Map<string, string[]>();
  const involved = new Set<string>();
  for (const edge of graph.edges) {
    if (
      !edge ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      throw new Error('Workflow edges must connect two nodes');
    }
    for (const id of [edge.source, edge.target]) {
      if (!nodeIds.has(id))
        throw new Error(`Workflow edge references missing node: ${id}`);
    }
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      edge.target,
    ]);
    involved.add(edge.source);
    involved.add(edge.target);
  }

  const starts = [...involved].filter((id) => !incoming.has(id));
  if (starts.length === 0)
    throw new Error('Workflow edges must not contain a cycle');
  if (starts.length > 1)
    throw new Error('Workflow must have exactly one start node');

  const waiting = new Map(
    [...incoming].map(([id, edges]) => [id, edges.length]),
  );
  const order: string[] = [];
  const ready = [starts[0]];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const target of outgoing.get(id) ?? []) {
      const left = (waiting.get(target) ?? 0) - 1;
      waiting.set(target, left);
      if (left === 0) ready.push(target);
    }
  }
  if (order.length !== involved.size)
    throw new Error('Workflow edges must not contain a cycle');
  return { order, incoming };
}
