import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CheckPublishTriggersQuery } from '@app/designer/application/queries/check-publish-triggers.query';
import type { PublishValidationIssue } from '@app/designer/application/utils';
import { WorkflowTriggerRepository } from '../../domain/workflow-trigger.repository';
import {
  findTriggerNodes,
  TriggerChannel,
} from '../../domain/workflow-trigger';
import { findMessengerPage } from '../messenger-page';

const CREDENTIAL_PROBLEMS = {
  NOT_FOUND: 'The selected Facebook Page connection no longer exists.',
  WRONG_CONNECTOR: 'Select a Facebook Page connection for this trigger.',
  NO_PAGE_ID: 'The Facebook Page connection has no Page ID.',
} as const;

// A Facebook Page can feed only one workflow: Meta sends each message once.
@QueryHandler(CheckPublishTriggersQuery)
export class CheckPublishTriggersHandler implements IQueryHandler<CheckPublishTriggersQuery> {
  constructor(private readonly repository: WorkflowTriggerRepository) {}

  async execute(
    query: CheckPublishTriggersQuery,
  ): Promise<PublishValidationIssue[]> {
    const issues: PublishValidationIssue[] = [];
    const pagesInThisWorkflow = new Set<string>();

    for (const node of findTriggerNodes(query.definition)) {
      // A missing credential is already reported as a required field.
      if (node.channel !== TriggerChannel.MESSENGER || !node.credentialId) {
        continue;
      }
      const page = await findMessengerPage(
        this.repository,
        node.credentialId,
        query.ownerId,
      );
      if ('error' in page) {
        issues.push(
          issue(
            'INVALID_CREDENTIAL',
            node.nodeId,
            CREDENTIAL_PROBLEMS[page.error],
          ),
        );
        continue;
      }

      if (pagesInThisWorkflow.has(page.pageId)) {
        issues.push(
          issue(
            'CHANNEL_ALREADY_BOUND',
            node.nodeId,
            'Another Messenger trigger in this workflow already uses this Facebook Page.',
          ),
        );
        continue;
      }
      pagesInThisWorkflow.add(page.pageId);

      const listener = await this.repository.findActive(
        TriggerChannel.MESSENGER,
        page.pageId,
      );
      if (listener && listener.workflowId !== query.workflowId) {
        const name =
          (await this.repository.findWorkflowName(listener.workflowId)) ??
          'another workflow';
        issues.push(
          issue(
            'CHANNEL_ALREADY_BOUND',
            node.nodeId,
            `This Facebook Page is already used by the workflow "${name}". Remove its Messenger trigger and publish it again, or pick another Page.`,
          ),
        );
      }
    }
    return issues;
  }
}

const issue = (
  code: string,
  nodeId: string,
  message: string,
): PublishValidationIssue => ({ code, severity: 'error', message, nodeId });
