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
  // Present when the workflow is active: the version that listens now. With
  // `error` the new version could not listen: the previous version keeps
  // listening (active) or, when none did, the workflow was turned off.
  activation?: { active: boolean; versionId: string | null; error?: string };
}
