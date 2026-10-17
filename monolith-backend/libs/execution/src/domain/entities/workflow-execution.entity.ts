export interface WorkflowNode {
  id: string;
  data: { key: string; config?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  [key: string]: unknown;
}

// The edges may be stored in any order (the designer appends them as the user
// draws them), so the chain is rebuilt by following source -> target.
export function getExecutionOrder(definition: unknown): string[] {
  if (!definition || typeof definition !== 'object')
    throw new Error('Workflow definition is invalid');
  const graph = definition as Partial<WorkflowDefinition>;
  if (!Array.isArray(graph.edges) || graph.edges.length === 0)
    throw new Error('Workflow definition must contain a non-empty edge chain');
  if (!Array.isArray(graph.nodes))
    throw new Error('Workflow definition must contain nodes');

  const nextOf = new Map<string, string>();
  const targets = new Set<string>();
  for (const edge of graph.edges) {
    if (
      !edge ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string' ||
      nextOf.has(edge.source) ||
      targets.has(edge.target)
    ) {
      throw new Error('Workflow edges must form a single directed chain');
    }
    nextOf.set(edge.source, edge.target);
    targets.add(edge.target);
  }

  const starts = [...nextOf.keys()].filter((id) => !targets.has(id));
  if (starts.length !== 1) {
    throw new Error('Workflow edges must form a single directed chain');
  }
  const order = [starts[0]];
  for (let next = nextOf.get(starts[0]); next; next = nextOf.get(next)) {
    order.push(next);
  }
  if (order.length !== graph.edges.length + 1) {
    throw new Error('Workflow edges must form a single directed chain');
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const id of order) {
    if (!nodesById.has(id))
      throw new Error(`Workflow edge references missing node: ${id}`);
  }
  return order;
}
