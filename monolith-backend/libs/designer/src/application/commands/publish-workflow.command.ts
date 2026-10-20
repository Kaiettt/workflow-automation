/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { WorkflowDraftRepository } from '../../domain/repositories/workflow-draft.repository';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import { WorkflowVersionRepository } from '../../domain/repositories/workflow-version.repository';
import { WorkflowVersion } from '../../domain/entities/workflow-version.entity';
import { GetNodeConfigSchemasQuery } from '@app/node-library';

interface PublishValidationIssue {
  code: string;
  severity: 'error';
  message: string;
  nodeId?: string;
  field?: string;
}

interface PublishValidationReport {
  isValid: boolean;
  issues: PublishValidationIssue[];
}

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

    const nodes = draft.definition.nodes || [];
    const edges = draft.definition.edges || [];
    const nodeKeys = new Set<string>();
    for (const node of nodes) {
      if (typeof node.type === 'string') {
        nodeKeys.add(node.type);
      }
    }

    const nodeTypes = await this.queryBus.execute<
      GetNodeConfigSchemasQuery,
      { key: string; category: string; configSchema: unknown }[]
    >(new GetNodeConfigSchemasQuery([...nodeKeys]));
    const nodeTypesByKey = new Map(
      nodeTypes.map((nodeType) => [nodeType.key, nodeType]),
    );
    const triggers = nodes.filter(
      (node: any) => nodeTypesByKey.get(node.type)?.category === 'TRIGGER',
    );
    const actions = nodes.filter((node: any) => {
      const category = nodeTypesByKey.get(node.type)?.category;
      return category === 'INTEGRATION' || category === 'AI';
    });
    const issues: PublishValidationIssue[] = [];

    if (triggers.length === 0) {
      issues.push({
        code: 'NO_TRIGGER',
        severity: 'error',
        message: 'Workflow must contain at least one trigger node.',
      });
    }

    if (actions.length === 0) {
      issues.push({
        code: 'NO_ACTION',
        severity: 'error',
        message: 'Workflow must contain at least one action node.',
      });
    }

    for (const node of nodes) {
      const nodeType = nodeTypesByKey.get(node.type);
      if (!nodeType) {
        issues.push({
          code: 'UNKNOWN_NODE_TYPE',
          severity: 'error',
          nodeId: node.id,
          message: `Node type ${node.type ?? 'unknown'} is not available in the node catalog.`,
        });
        continue;
      }

      const schema = nodeType.configSchema as { required?: unknown } | null;
      const requiredFields = Array.isArray(schema?.required)
        ? schema.required.filter(
            (field): field is string => typeof field === 'string',
          )
        : [];
      const config = node.data?.config ?? {};

      for (const field of requiredFields) {
        const value = config[field];
        const isMissing =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim().length === 0);

        if (isMissing) {
          issues.push({
            code: 'REQUIRED_FIELD_MISSING',
            severity: 'error',
            nodeId: node.id,
            field,
            message: `Required field "${field}" is missing for ${node.data?.name ?? node.type}.`,
          });
        }
      }
    }

    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
        continue;
      }
      adjacency.set(edge.source, [
        ...(adjacency.get(edge.source) ?? []),
        edge.target,
      ]);
    }

    const reachable = new Set<string>();
    const pending = triggers.map((trigger: any) => trigger.id);
    while (pending.length > 0) {
      const nodeId = pending.pop();
      if (typeof nodeId !== 'string' || reachable.has(nodeId)) {
        continue;
      }

      reachable.add(nodeId);
      pending.push(...(adjacency.get(nodeId) ?? []));
    }

    for (const action of actions) {
      if (!reachable.has(action.id)) {
        issues.push({
          code: 'ACTION_UNREACHABLE',
          severity: 'error',
          nodeId: action.id,
          message: `Action node ${action.data?.name ?? action.id} is not reachable from any trigger node.`,
        });
      }
    }

    const validationReport: PublishValidationReport = {
      isValid: issues.length === 0,
      issues,
    };

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
    draft: any,
    issues: PublishValidationIssue[],
  ) {
    draft.validationErrors = { issues };
    await this.workflowDraftRepo.upsert(draft);
  }
}
