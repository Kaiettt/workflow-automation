// Asked while publishing; answered by the triggers module. Returns issues that
// would stop the version's integration nodes from working (e.g. a credential
// the owner no longer has). Result: PublishValidationIssue[].
export class CheckPublishTriggersQuery {
  constructor(
    readonly workflowId: string,
    readonly ownerId: string,
    readonly definition: unknown,
  ) {}
}
