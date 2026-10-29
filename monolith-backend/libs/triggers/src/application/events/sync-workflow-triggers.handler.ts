import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { WorkflowPublishedEvent } from '@app/designer/application/events/workflow-published.event';
import { WorkflowTriggerRepository } from '../../domain/workflow-trigger.repository';
import {
  findTriggerNodes,
  planTriggers,
  TriggerChannel,
  TriggerNode,
} from '../../domain/workflow-trigger';
import { findMessengerPage } from '../messenger-page';

// Only the current version listens: re-publishing replaces the listeners.
@EventsHandler(WorkflowPublishedEvent)
export class SyncWorkflowTriggersHandler implements IEventHandler<WorkflowPublishedEvent> {
  private readonly logger = new Logger(SyncWorkflowTriggersHandler.name);

  constructor(private readonly repository: WorkflowTriggerRepository) {}

  async handle(event: WorkflowPublishedEvent): Promise<void> {
    try {
      const nodes = findTriggerNodes(event.definition);
      const previous = await this.repository.findByWorkflow(event.workflowId);
      const channelKeys = await this.resolveChannelKeys(
        event.workflowId,
        nodes,
      );
      await this.repository.replaceActive(
        event.workflowId,
        event.versionId,
        planTriggers(nodes, previous, channelKeys),
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

  // Page id of each Messenger trigger. Publish validation already rejected
  // unusable credentials; one deleted since is skipped (it cannot listen).
  private async resolveChannelKeys(
    workflowId: string,
    nodes: TriggerNode[],
  ): Promise<Map<string, string>> {
    const keys = new Map<string, string>();
    const messengerNodes = nodes.filter(
      (node) => node.channel === TriggerChannel.MESSENGER && node.credentialId,
    );
    if (messengerNodes.length === 0) return keys;

    const ownerId = await this.repository.findWorkflowOwnerId(workflowId);
    if (!ownerId) return keys;
    for (const node of messengerNodes) {
      const page = await findMessengerPage(
        this.repository,
        node.credentialId!,
        ownerId,
      );
      if ('pageId' in page) keys.set(node.nodeId, page.pageId);
      else {
        this.logger.warn(
          `Messenger trigger ${node.nodeId} of workflow ${workflowId} has no usable Page (${page.error})`,
        );
      }
    }
    return keys;
  }
}
