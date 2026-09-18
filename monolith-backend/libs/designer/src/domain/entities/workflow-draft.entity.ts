export class WorkflowDraft {
  constructor(
    public readonly workflowId: string,
    public readonly definition: Record<string, any>,
    public readonly validationErrors?: Record<string, any> | null,
    public readonly lockedById?: string | null,
    public readonly lockedAt?: Date | null,
    public readonly updatedAt?: Date,
  ) {}

  static create(
    workflowId: string,
    definition: Record<string, any>,
  ): WorkflowDraft {
    return new WorkflowDraft(workflowId, definition);
  }
}
