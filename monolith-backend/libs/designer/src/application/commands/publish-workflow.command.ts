/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  CommandBus,
  CommandHandler,
  CommandHandlerNotFoundException,
  EventBus,
  ICommandHandler,
  QueryBus,
  QueryHandlerNotFoundException,
} from '@nestjs/cqrs';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersion } from '../../domain/entities/workflow-version.entity';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';
import { GetNodeConfigSchemasQuery } from '@app/node-library/application/queries/get-node-config-schemas.query';
import { WorkflowPublishedEvent } from '../events/workflow-published.event';
import { CheckPublishTriggersQuery } from '../queries/check-publish-triggers.query';
import {
  SwitchActiveVersionCommand,
  SwitchActiveVersionResult,
} from './switch-active-version.command';
import {
  extractNodeCatalogKeys,
  validateWorkflowDraft,
  NodeCatalogTypeInfo,
  PublishValidationIssue,
} from '../utils';

export class PublishWorkflowCommand {
  constructor(
    public readonly workflowId: string,
    public readonly publishedById: string,
  ) {}
}

@CommandHandler(PublishWorkflowCommand)
export class PublishWorkflowHandler implements ICommandHandler<PublishWorkflowCommand> {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly workflowDraftRepo: WorkflowDraftRepository,
    private readonly workflowVersionRepo: WorkflowVersionRepository,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: PublishWorkflowCommand): Promise<{
    versionId: string;
    versionNumber: number;
    // Set when the workflow is active: its listeners moved to the new version,
    // or (active: false) that failed and the workflow was turned off.
    activation?: { active: boolean; error?: string };
  }> {
    const { workflowId, publishedById } = command;

    const existingWorkflow = await this.workflowRepo.findById(workflowId);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found.`);
    }

    const draft = await this.workflowDraftRepo.findById(workflowId);
    if (!draft || !draft.definition) {
      throw new BadRequestException('Workflow draft is empty or not found.');
    }

    const nodeKeys = extractNodeCatalogKeys(draft.definition.nodes || []);
    const nodeTypes = await this.queryBus.execute<
      GetNodeConfigSchemasQuery,
      NodeCatalogTypeInfo[]
    >(new GetNodeConfigSchemasQuery(nodeKeys));

    const nodeTypesByKey = new Map(
      nodeTypes.map((nodeType) => [nodeType.key, nodeType]),
    );

    const validationReport = validateWorkflowDraft(
      draft.definition,
      nodeTypesByKey,
    );
    const triggerIssues = await this.checkTriggers(
      new CheckPublishTriggersQuery(
        workflowId,
        existingWorkflow.ownerId,
        draft.definition,
      ),
    );
    const issues = [...validationReport.issues, ...triggerIssues];

    if (issues.length > 0) {
      await this.saveValidationErrors(draft, issues);
      throw new BadRequestException({
        message: 'Workflow validation failed.',
        issues,
      });
    }

    // Success - clear validation errors
    if (draft.validationErrors) {
      draft.validationErrors = null;
      await this.workflowDraftRepo.upsert(draft);
    }

    // Create version
    const latestVersion =
      await this.workflowVersionRepo.findLatestByWorkflowId(workflowId);
    const newVersionNumber = latestVersion
      ? latestVersion.versionNumber + 1
      : 1;

    const newVersion = WorkflowVersion.create({
      workflowId,
      versionNumber: newVersionNumber,
      definition: draft.definition,
      publishedById,
    });

    await this.workflowVersionRepo.save(newVersion);

    // Update workflow current version
    existingWorkflow.currentVersionId = newVersion.id;
    await this.workflowRepo.update(existingWorkflow);

    this.eventBus.publish(
      new WorkflowPublishedEvent(workflowId, newVersion.id, draft.definition),
    );

    const activation = await switchActiveVersion(this.commandBus, workflowId);

    return {
      versionId: newVersion.id,
      versionNumber: newVersion.versionNumber,
      ...(activation ? { activation } : {}),
    };
  }

  // Without the triggers module loaded (e.g. a test app) there is nothing to check.
  private async checkTriggers(
    query: CheckPublishTriggersQuery,
  ): Promise<PublishValidationIssue[]> {
    try {
      const issues = await this.queryBus.execute<
        CheckPublishTriggersQuery,
        PublishValidationIssue[] | undefined
      >(query);
      return Array.isArray(issues) ? issues : [];
    } catch (error) {
      if (error instanceof QueryHandlerNotFoundException) return [];
      throw error;
    }
  }

  private async saveValidationErrors(
    draft: WorkflowDraft,
    issues: PublishValidationIssue[],
  ) {
    draft.validationErrors = { issues };
    await this.workflowDraftRepo.upsert(draft);
  }
}

// Without the triggers module loaded (e.g. a test app) nothing listens.
export async function switchActiveVersion(
  commandBus: CommandBus,
  workflowId: string,
): Promise<SwitchActiveVersionResult> {
  try {
    return await commandBus.execute<
      SwitchActiveVersionCommand,
      SwitchActiveVersionResult
    >(new SwitchActiveVersionCommand(workflowId));
  } catch (error) {
    if (error instanceof CommandHandlerNotFoundException) return null;
    throw error;
  }
}
