import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { WorkflowPublishedEvent } from '@app/designer/application/events/workflow-published.event';
import { WorkflowTriggerRepository } from '../../domain/workflow-trigger.repository';
import { findTriggerNodes, planTriggers } from '../../domain/workflow-trigger';

// Only the current version listens: re-publishing replaces the listeners.
@EventsHandler(WorkflowPublishedEvent)
export class SyncWorkflowTriggersHandler implements IEventHandler<WorkflowPublishedEvent> {
  private readonly logger = new Logger(SyncWorkflowTriggersHandler.name);

  constructor(private readonly repository: WorkflowTriggerRepository) {}

  async handle(event: WorkflowPublishedEvent): Promise<void> {
    try {
      const previous = await this.repository.findByWorkflow(event.workflowId);
      const triggers = planTriggers(
        findTriggerNodes(event.definition),
        previous,
      );
      await this.repository.replaceActive(
        event.workflowId,
        event.versionId,
        triggers,
      );
    } catch (error) {
      // The event bus swallows rejections; make the failure visible.
      this.logger.error(
        `Could not sync triggers of workflow ${event.workflowId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
