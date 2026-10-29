import { randomBytes } from 'node:crypto';

export enum TriggerChannel {
  WEBHOOK = 'WEBHOOK',
  MESSENGER = 'MESSENGER',
  ZALO_OA = 'ZALO_OA',
}

export const TriggerKeys = {
  WEBHOOK: 'trigger.webhook',
} as const;

// Node keys that make a published version listen for outside events.
const CHANNEL_BY_KEY: Record<string, TriggerChannel> = {
  [TriggerKeys.WEBHOOK]: TriggerChannel.WEBHOOK,
};

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  triggerKey: string;
  channel: TriggerChannel;
  // WEBHOOK: secret token in the URL. Later channels: page / OA id.
  routingKey: string;
  isActive: boolean;
  createdAt: Date;
}

export type NewWorkflowTrigger = Pick<
  WorkflowTrigger,
  'nodeId' | 'triggerKey' | 'channel' | 'routingKey'
>;

export interface TriggerNode {
  nodeId: string;
  triggerKey: string;
  channel: TriggerChannel;
}

// Trigger nodes of a definition that need a listener (manual triggers don't).
export function findTriggerNodes(definition: unknown): TriggerNode[] {
  const nodes = (definition as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return [];

  const found: TriggerNode[] = [];
  for (const node of nodes as Array<{
    id?: unknown;
    data?: { key?: unknown };
  }>) {
    const key = node?.data?.key;
    if (typeof node?.id !== 'string' || typeof key !== 'string') continue;
    const channel = CHANNEL_BY_KEY[key];
    if (channel) found.push({ nodeId: node.id, triggerKey: key, channel });
  }
  return found;
}

// Plans the listeners for a newly published version. A webhook node keeps the
// token it had in earlier versions, so its URL survives re-publishing.
export function planTriggers(
  triggerNodes: TriggerNode[],
  previous: readonly WorkflowTrigger[],
  newToken: () => string = generateWebhookToken,
): NewWorkflowTrigger[] {
  return triggerNodes.map((node) => {
    const earlier = previous
      .filter((t) => t.nodeId === node.nodeId && t.channel === node.channel)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      ...node,
      routingKey: earlier?.routingKey ?? newToken(),
    };
  });
}

export function generateWebhookToken(): string {
  return randomBytes(32).toString('base64url');
}
