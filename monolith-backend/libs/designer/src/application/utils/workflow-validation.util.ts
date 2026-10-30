/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

import { resolveOutputs } from '@app/shared/utils/node-outputs';

export interface PublishValidationIssue {
  code: string;
  severity: 'error';
  message: string;
  nodeId?: string;
  field?: string;
}

export interface PublishValidationReport {
  isValid: boolean;
  issues: PublishValidationIssue[];
}

export interface NodeCatalogTypeInfo {
  key: string;
  category: string;
  configSchema: unknown;
}

/**
 * Extracts the catalog key from a workflow node.
 * React Flow designer nodes store the catalog key in `node.data.key`.
 * Legacy/unit test mock nodes may store the catalog key in `node.type`.
 */
export function getNodeKey(node: any): string | undefined {
  if (typeof node?.data?.key === 'string' && node.data.key.length > 0) {
    return node.data.key;
  }
  if (
    typeof node?.type === 'string' &&
    node.type !== 'actionNode' &&
    node.type !== 'triggerNode'
  ) {
    return node.type;
  }
  return undefined;
}

/**
 * Extracts all unique node catalog keys present in the nodes array.
 */
export function extractNodeCatalogKeys(nodes: any[]): string[] {
  const nodeKeys = new Set<string>();
  for (const node of nodes) {
    const key = getNodeKey(node);
    if (key) {
      nodeKeys.add(key);
    }
  }
  return [...nodeKeys];
}

/**
 * Filters trigger nodes (category TRIGGER or UI triggerNode).
 */
export function getTriggerNodes(
  nodes: any[],
  nodeTypesByKey: Map<string, { category?: string }>,
): any[] {
  return nodes.filter((node: any) => {
    const key = getNodeKey(node);
    const category = key ? nodeTypesByKey.get(key)?.category : undefined;
    return category === 'TRIGGER' || node.type === 'triggerNode';
  });
}

/**
 * Filters action/processing nodes (any operational node that is not a trigger).
 */
export function getActionNodes(
  nodes: any[],
  nodeTypesByKey: Map<string, { category?: string }>,
): any[] {
  return nodes.filter((node: any) => {
    const key = getNodeKey(node);
    const category = key ? nodeTypesByKey.get(key)?.category : undefined;
    return category ? category !== 'TRIGGER' : node.type !== 'triggerNode';
  });
}

/**
 * Validates a workflow draft definition against node catalog schemas and graph reachability rules.
 */
export function validateWorkflowDraft(
  definition: { nodes?: any[]; edges?: any[] },
  nodeTypesByKey: Map<string, { category: string; configSchema: unknown }>,
): PublishValidationReport {
  const nodes = definition.nodes || [];
  const edges = definition.edges || [];
  const issues: PublishValidationIssue[] = [];

  const triggers = getTriggerNodes(nodes, nodeTypesByKey);
  const actions = getActionNodes(nodes, nodeTypesByKey);

  if (triggers.length === 0) {
    issues.push({
      code: 'NO_TRIGGER',
      severity: 'error',
      message: 'Workflow must contain at least one trigger node.',
    });
  }

  if (actions.length === 0) {
    issues.push({
      code: 'NO_ACTION',
      severity: 'error',
      message: 'Workflow must contain at least one action node.',
    });
  }

  // Schema validation
  for (const node of nodes) {
    const key = getNodeKey(node);
    const nodeType = key ? nodeTypesByKey.get(key) : undefined;

    if (!nodeType) {
      issues.push({
        code: 'UNKNOWN_NODE_TYPE',
        severity: 'error',
        nodeId: node.id,
        message: `Node type ${key ?? node.type ?? 'unknown'} is not available in the node catalog.`,
      });
      continue;
    }

    const schema = nodeType.configSchema as { required?: unknown } | null;
    const requiredFields = Array.isArray(schema?.required)
      ? schema.required.filter(
          (field): field is string => typeof field === 'string',
        )
      : [];
    const config = node.data?.config ?? {};

    for (const field of requiredFields) {
      const value = config[field];
      const isMissing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0);

      if (isMissing) {
        issues.push({
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error',
          nodeId: node.id,
          field,
          message: `Required field "${field}" is missing for ${node.data?.name ?? key}.`,
        });
      }
    }
  }

  // Graph reachability validation
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      continue;
    }
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) ?? []),
      edge.target,
    ]);
  }

  const reachable = new Set<string>();
  const pending = triggers.map((trigger: any) => trigger.id);
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (typeof nodeId !== 'string' || reachable.has(nodeId)) {
      continue;
    }

    reachable.add(nodeId);
    pending.push(...(adjacency.get(nodeId) ?? []));
  }

  for (const action of actions) {
    if (!reachable.has(action.id)) {
      issues.push({
        code: 'ACTION_UNREACHABLE',
        severity: 'error',
        nodeId: action.id,
        message: `Action node ${action.data?.name ?? action.id} is not reachable from any trigger node.`,
      });
    }
  }

  issues.push(...validateGraphShape(nodes, edges, nodeTypesByKey));

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * The flow must have one start node and no cycle, and every edge must leave
 * from an output its node still has (a Switch rule may have been deleted).
 */
function validateGraphShape(
  nodes: any[],
  edges: any[],
  nodeTypesByKey: Map<string, { configSchema: unknown }>,
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const valid = edges.filter(
    (edge: any) =>
      typeof edge?.source === 'string' && typeof edge?.target === 'string',
  );

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const involved = new Set<string>();
  for (const edge of valid) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      edge.target,
    ]);
    involved.add(edge.source);
    involved.add(edge.target);
  }

  const starts = [...involved].filter((id) => !incoming.has(id));
  if (starts.length > 1) {
    issues.push({
      code: 'MULTIPLE_START',
      severity: 'error',
      message:
        'Workflow must start from a single node; more than one node has no incoming connection.',
    });
  }

  // Kahn: whatever cannot be ordered is on, or behind, a cycle.
  const waiting = new Map(incoming);
  const ready = starts.slice();
  let ordered = 0;
  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered += 1;
    for (const target of outgoing.get(id) ?? []) {
      const left = (waiting.get(target) ?? 0) - 1;
      waiting.set(target, left);
      if (left === 0) ready.push(target);
    }
  }
  if (ordered < involved.size) {
    issues.push({
      code: 'GRAPH_CYCLE',
      severity: 'error',
      message: 'Workflow connections must not form a loop.',
    });
  }

  const nodesById = new Map(nodes.map((node: any) => [node.id, node]));
  for (const edge of valid) {
    const handle = edge.sourceHandle;
    if (typeof handle !== 'string' || !handle.startsWith('out:')) continue;
    const source = nodesById.get(edge.source);
    const key = source ? getNodeKey(source) : undefined;
    const nodeType = key ? nodeTypesByKey.get(key) : undefined;
    if (!source || !nodeType) continue;
    const outputs = resolveOutputs(
      nodeType.configSchema,
      source.data?.config ?? {},
    );
    if (!outputs.some((output) => `out:${output.key}` === handle)) {
      issues.push({
        code: 'UNKNOWN_OUTPUT',
        severity: 'error',
        nodeId: source.id,
        message: `A connection leaves ${source.data?.name ?? source.id} from an output that no longer exists.`,
      });
    }
  }
  return issues;
}
