/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersion } from '../../domain/entities/workflow-version.entity';

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

    const nodes = draft.definition.nodes || [];
    const edges = draft.definition.edges || [];

    const triggers = nodes.filter(
      (n: any) => n.type && n.type.startsWith('trigger'),
    );
    const actions = nodes.filter(
      (n: any) => n.type && !n.type.startsWith('action'),
    );

    if (triggers.length !== 1) {
      await this.saveValidationError(
        draft,
        'Workflow must have exactly one trigger node.',
      );
      throw new BadRequestException(
        'Workflow must have exactly one trigger node.',
      );
    }

    if (actions.length === 0) {
      await this.saveValidationError(
        draft,
        'Workflow must have at least one action node.',
      );
      throw new BadRequestException(
        'Workflow must have at least one action node.',
      );
    }

    // Check for disconnected nodes (every node except the trigger should have an incoming edge,
    // and every node except leaf nodes should have an outgoing edge. For simplicity, just ensure every node is in an edge if there are >1 nodes)
    if (nodes.length > 1) {
      const connectedNodeIds = new Set([
        ...edges.map((e: any) => e.source),
        ...edges.map((e: any) => e.target),
      ]);

      const disconnected = nodes.find((n: any) => !connectedNodeIds.has(n.id));
      if (disconnected) {
        await this.saveValidationError(
          draft,
          `Node ${disconnected.data?.name || disconnected.id} is disconnected.`,
        );
        throw new BadRequestException(
          `Node ${disconnected.data?.name || disconnected.id} is disconnected.`,
        );
      }
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

  private async saveValidationError(draft: any, message: string) {
    draft.validationErrors = { message };
    await this.workflowDraftRepo.upsert(draft);
  }
}
