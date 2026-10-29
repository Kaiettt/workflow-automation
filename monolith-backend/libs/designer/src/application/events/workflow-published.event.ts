// Raised after a new version became the workflow's current version.
export class WorkflowPublishedEvent {
  constructor(
    readonly workflowId: string,
    readonly versionId: string,
    readonly definition: unknown,
  ) {}
}
