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

export function getExecutionOrder(definition: unknown): string[] {
  if (!definition || typeof definition !== 'object')
    throw new Error('Workflow definition is invalid');
  const graph = definition as Partial<WorkflowDefinition>;
  if (!Array.isArray(graph.edges) || graph.edges.length === 0)
    throw new Error('Workflow definition must contain a non-empty edge chain');
  if (!Array.isArray(graph.nodes))
    throw new Error('Workflow definition must contain nodes');
  const order = [graph.edges[0].source];
  for (let index = 0; index < graph.edges.length; index += 1) {
    const edge = graph.edges[index];
    if (
      !edge ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string' ||
      (index > 0 && edge.source !== graph.edges[index - 1].target)
    ) {
      throw new Error('Workflow edges must form a single directed chain');
    }
    order.push(edge.target);
  }
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const id of order) {
    if (typeof id !== 'string' || !nodesById.has(id))
      throw new Error(`Workflow edge references missing node: ${String(id)}`);
  }
  return order;
}
