// A node of a workflow definition (React Flow JSON), reduced to what the
// triggers module reads.
export interface DefinitionNode {
  id: string;
  key: string;
  name: string;
  config: Record<string, unknown>;
}

export function definitionNodes(definition: unknown): DefinitionNode[] {
  const nodes = (definition as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return [];
  const found: DefinitionNode[] = [];
  for (const node of nodes as Array<{
    id?: unknown;
    data?: { key?: unknown; name?: unknown; config?: unknown };
  }>) {
    if (typeof node?.id !== 'string' || typeof node.data?.key !== 'string') {
      continue;
    }
    const config = node.data.config;
    found.push({
      id: node.id,
      key: node.data.key,
      name: typeof node.data.name === 'string' ? node.data.name : node.id,
      config:
        typeof config === 'object' && config !== null && !Array.isArray(config)
          ? (config as Record<string, unknown>)
          : {},
    });
  }
  return found;
}
