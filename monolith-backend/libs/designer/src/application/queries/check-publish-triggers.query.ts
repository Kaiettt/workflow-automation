// Asked while publishing; answered by the triggers module. Returns issues that
// would stop the version from receiving events (e.g. a Facebook Page another
// workflow already listens on). Result: PublishValidationIssue[].
export class CheckPublishTriggersQuery {
  constructor(
    readonly workflowId: string,
    readonly ownerId: string,
    readonly definition: unknown,
  ) {}
}
