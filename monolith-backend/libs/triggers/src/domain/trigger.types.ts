import { randomUUID } from 'node:crypto';

// A public URL /api/webhooks/<id>; its scope (node or credential) comes from
// the trigger node's package.
export interface WebhookEndpoint {
  id: string;
  scopeKey: string;
  nodeKey: string;
  workflowId: string | null;
  credentialId: string | null;
  ownerId: string;
  data: Record<string, unknown>;
  registered: boolean;
}

export type NewWebhookEndpoint = Omit<WebhookEndpoint, 'id' | 'registered'>;

// A trigger node of an active workflow, listening on an endpoint.
export interface Listener {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  nodeKey: string;
  endpointId: string;
  credentialId: string | null;
  parameters: Record<string, unknown>;
}

export type NewListener = Omit<
  Listener,
  'id' | 'workflowId' | 'workflowVersionId'
>;

export interface WorkflowRef {
  id: string;
  name: string;
  ownerId: string;
  active: boolean;
  currentVersionId: string | null;
}

// A trigger node waiting for one test event (draft config, no execution).
export interface TestListen {
  id: string;
  userId: string;
  workflowId: string;
  nodeId: string;
  endpointId: string;
  nodeKey: string;
  parameters: Record<string, unknown>;
  status: 'waiting' | 'received';
  event: Record<string, unknown> | null;
  expiresAt: string; // ISO
}

export const TEST_LISTEN_SECONDS = 120;

export function scopeKeyOf(
  scope: 'node' | 'credential',
  workflowId: string,
  nodeId: string,
  credentialId: string | null,
): string {
  return scope === 'node'
    ? `node:${workflowId}:${nodeId}`
    : `credential:${credentialId}`;
}

export function newTestListenId(): string {
  return randomUUID();
}
