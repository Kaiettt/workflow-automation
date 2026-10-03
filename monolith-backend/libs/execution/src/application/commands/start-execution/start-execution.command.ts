export class StartExecutionCommand {
  constructor(
    readonly workflowVersionId: string,
    readonly actorId: string,
  ) {}
}
