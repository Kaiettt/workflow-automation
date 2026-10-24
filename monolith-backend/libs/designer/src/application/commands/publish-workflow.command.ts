/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersion } from '../../domain/entities/workflow-version.entity';
import { WorkflowDraft } from '../../domain/entities/workflow-draft.entity';
import { GetNodeConfigSchemasQuery } from '@app/node-library/application/queries/get-node-config-schemas.query';
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
  ) {}

  async execute(
    command: PublishWorkflowCommand,
  ): Promise<{ versionId: string; versionNumber: number }> {
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

    if (!validationReport.isValid) {
      await this.saveValidationErrors(draft, validationReport.issues);
      throw new BadRequestException({
        message: 'Workflow validation failed.',
        issues: validationReport.issues,
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

    return {
      versionId: newVersion.id,
      versionNumber: newVersion.versionNumber,
    };
  }

  private async saveValidationErrors(
    draft: WorkflowDraft,
    issues: PublishValidationIssue[],
  ) {
    draft.validationErrors = { issues };
    await this.workflowDraftRepo.upsert(draft);
  }
}
