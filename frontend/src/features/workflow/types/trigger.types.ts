// The Active switch of a workflow (GET /api/workflows/:id/activation).
export interface ActivationState {
  active: boolean;
  // The version that receives events while active.
  versionId: string | null;
}

// Webhook URL of a trigger node of the draft.
export interface NodeWebhook {
  nodeId: string;
  nodeKey: string;
  // 'node': own URL; 'credential': shared by every node using the credential.
  scope: 'node' | 'credential';
  // Null until the node's credential is chosen (credential scope).
  url: string | null;
}

export type TestListenStatus = 'waiting' | 'received' | 'expired';

export interface TestListen {
  listenId: string;
  status: TestListenStatus;
  event: Record<string, unknown> | null;
  expiresAt: string;
}

// One choice of a field whose options come from the server (x-loadOptions).
export interface NodeOption {
  value: string;
  label: string;
}

// x-webhook on a trigger node's config schema.
export interface WebhookHint {
  scope: 'node' | 'credential';
}
