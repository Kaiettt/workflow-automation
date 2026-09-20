import { randomUUID } from 'crypto';

export class WorkflowVersion {
  constructor(
    public readonly id: string,
    public readonly workflowId: string,
    public readonly versionNumber: number,
    public readonly definition: Record<string, any>,
    public readonly publishedById: string,
    public readonly publishedAt: Date,
    public readonly createdAt?: Date,
  ) {}

  static create(props: {
    id?: string;
    workflowId: string;
    versionNumber: number;
    definition: Record<string, any>;
    publishedById: string;
  }): WorkflowVersion {
    return new WorkflowVersion(
      props.id || randomUUID(),
      props.workflowId,
      props.versionNumber,
      props.definition,
      props.publishedById,
      new Date(),
    );
  }
}
