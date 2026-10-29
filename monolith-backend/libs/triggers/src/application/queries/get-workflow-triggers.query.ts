export class GetWorkflowTriggersQuery {
  constructor(
    readonly workflowId: string,
    readonly userId: string,
  ) {}
}

export interface WorkflowTriggerView {
  nodeId: string;
  triggerKey: string;
  channel: string;
  // Only this version receives events (the current one).
  workflowVersionId: string;
  webhookUrl: string | null;
}

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkflowTriggerRepository } from '../../domain/workflow-trigger.repository';
import { TriggerChannel } from '../../domain/workflow-trigger';

@QueryHandler(GetWorkflowTriggersQuery)
export class GetWorkflowTriggersHandler implements IQueryHandler<GetWorkflowTriggersQuery> {
  constructor(private readonly repository: WorkflowTriggerRepository) {}

  async execute(
    query: GetWorkflowTriggersQuery,
  ): Promise<WorkflowTriggerView[]> {
    const ownerId = await this.repository.findWorkflowOwnerId(query.workflowId);
    if (!ownerId) throw new NotFoundException('Workflow not found');
    if (ownerId !== query.userId) {
      throw new ForbiddenException('You cannot view this workflow');
    }

    const triggers = await this.repository.findByWorkflow(query.workflowId);
    return triggers
      .filter((trigger) => trigger.isActive)
      .map((trigger) => ({
        nodeId: trigger.nodeId,
        triggerKey: trigger.triggerKey,
        workflowVersionId: trigger.workflowVersionId,
        channel: trigger.channel,
        webhookUrl:
          trigger.channel === TriggerChannel.WEBHOOK
            ? `${publicBaseUrl()}/api/webhooks/w/${trigger.routingKey}`
            : null,
      }));
  }
}

// Address outside callers use; falls back to the local server.
export function publicBaseUrl(): string {
  const configured = process.env['PUBLIC_BASE_URL']?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `http://localhost:${process.env['PORT'] ?? 8080}`;
}
