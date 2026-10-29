export interface WorkflowSummary {
  id: string;
  name: string;
  status: string;
  // The Active switch: the published version listens for events.
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishResult {
  versionId: string;
  versionNumber: number;
  // Present when the workflow is active: its listeners moved to the new
  // version, or (active: false) that failed and the workflow was turned off.
  activation?: { active: boolean; error?: string };
}
