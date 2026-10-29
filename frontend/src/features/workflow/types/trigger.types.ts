// A listener of the published version (e.g. a webhook URL).
export interface WorkflowTrigger {
  nodeId: string;
  triggerKey: string;
  channel: 'WEBHOOK' | 'MESSENGER' | 'ZALO_OA';
  // Only this version receives events.
  workflowVersionId: string;
  webhookUrl: string | null;
}
