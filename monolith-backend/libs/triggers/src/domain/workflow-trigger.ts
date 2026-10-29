import { randomBytes } from 'node:crypto';

export enum TriggerChannel {
  WEBHOOK = 'WEBHOOK',
  MESSENGER = 'MESSENGER',
  ZALO_OA = 'ZALO_OA',
}

export const TriggerKeys = {
  WEBHOOK: 'trigger.webhook',
  MESSENGER_MESSAGE: 'trigger.messenger.message',
} as const;

// Node keys that make a published version listen for outside events.
const CHANNEL_BY_KEY: Record<string, TriggerChannel> = {
  [TriggerKeys.WEBHOOK]: TriggerChannel.WEBHOOK,
  [TriggerKeys.MESSENGER_MESSAGE]: TriggerChannel.MESSENGER,
};

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  triggerKey: string;
  channel: TriggerChannel;
  // WEBHOOK: secret token in the URL. MESSENGER: page id.
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
  // config.credential_id of chat triggers (the Page to listen on).
  credentialId?: string;
}

// Trigger nodes of a definition that need a listener (manual triggers don't).
export function findTriggerNodes(definition: unknown): TriggerNode[] {
  const nodes = (definition as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return [];

  const found: TriggerNode[] = [];
  for (const node of nodes as Array<{
    id?: unknown;
    data?: { key?: unknown; config?: { credential_id?: unknown } };
  }>) {
    const key = node?.data?.key;
    if (typeof node?.id !== 'string' || typeof key !== 'string') continue;
    const channel = CHANNEL_BY_KEY[key];
    if (!channel) continue;
    const credentialId = node.data?.config?.credential_id;
    found.push({
      nodeId: node.id,
      triggerKey: key,
      channel,
      ...(typeof credentialId === 'string' && credentialId
        ? { credentialId }
        : {}),
    });
  }
  return found;
}

// Plans the listeners for a newly published version. A webhook node keeps the
// token it had in earlier versions, so its URL survives re-publishing; chat
// triggers listen on the key resolved from their credential (`channelKeys`,
// by node id) and are left out when it could not be resolved.
export function planTriggers(
  triggerNodes: TriggerNode[],
  previous: readonly WorkflowTrigger[],
  channelKeys: ReadonlyMap<string, string> = new Map(),
  newToken: () => string = generateWebhookToken,
): NewWorkflowTrigger[] {
  const planned: NewWorkflowTrigger[] = [];
  for (const { nodeId, triggerKey, channel } of triggerNodes) {
    if (channel !== TriggerChannel.WEBHOOK) {
      const routingKey = channelKeys.get(nodeId);
      if (routingKey) planned.push({ nodeId, triggerKey, channel, routingKey });
      continue;
    }
    const earlier = previous
      .filter((t) => t.nodeId === nodeId && t.channel === channel)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    planned.push({
      nodeId,
      triggerKey,
      channel,
      routingKey: earlier?.routingKey ?? newToken(),
    });
  }
  return planned;
}

export function generateWebhookToken(): string {
  return randomBytes(32).toString('base64url');
}
