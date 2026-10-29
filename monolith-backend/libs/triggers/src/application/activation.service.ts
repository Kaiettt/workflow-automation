import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CREDENTIAL_FIELD, PackageRegistry } from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { webhookUrl } from '@app/shared/utils/public-base-url';
import { TriggerRepository } from '../domain/trigger.repository';
import { NewListener, WorkflowRef } from '../domain/trigger.types';
import { definitionNodes } from '../domain/definition-nodes';
import { EndpointRegistrar, PreparedTrigger } from './endpoint-registrar';

export interface ActivationState {
  active: boolean;
  // The version that receives events while active.
  versionId: string | null;
}

export interface NodeWebhook {
  nodeId: string;
  nodeKey: string;
  scope: 'node' | 'credential';
  // Null until the node's credential is chosen (credential scope).
  url: string | null;
}

// The Active switch: only active workflows listen, with their current
// published version. Activation registers the webhooks with the outside apps
// and either fully succeeds or leaves the workflow off.
@Injectable()
export class ActivationService {
  constructor(
    private readonly registry: PackageRegistry,
    private readonly repository: TriggerRepository,
    private readonly registrar: EndpointRegistrar,
    private readonly vault: CredentialVault,
  ) {}

  async state(workflowId: string, userId: string): Promise<ActivationState> {
    const workflow = await this.ownedWorkflow(workflowId, userId);
    return stateOf(workflow);
  }

  async activate(workflowId: string, userId: string): Promise<ActivationState> {
    const workflow = await this.ownedWorkflow(workflowId, userId);
    if (!workflow.currentVersionId) {
      throw new BadRequestException(
        'Publish the workflow before activating it.',
      );
    }
    await this.listen(workflow, workflow.currentVersionId);
    await this.repository.setActive(workflow.id, true);
    return { active: true, versionId: workflow.currentVersionId };
  }

  async deactivate(
    workflowId: string,
    userId: string,
  ): Promise<ActivationState> {
    const workflow = await this.ownedWorkflow(workflowId, userId);
    await this.stop(workflow);
    return { active: false, versionId: null };
  }

  // After a publish / restore: an active workflow listens with the new
  // version. If that fails the workflow is turned off. Null when inactive.
  async switchVersion(
    workflowId: string,
  ): Promise<{ active: boolean; error?: string } | null> {
    const workflow = await this.repository.findWorkflow(workflowId);
    if (!workflow?.active || !workflow.currentVersionId) return null;
    try {
      await this.listen(workflow, workflow.currentVersionId);
      return { active: true };
    } catch (error) {
      await this.stop(workflow);
      return {
        active: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Webhook URLs of the draft's trigger nodes, so they can be copied before
  // the workflow is published or activated.
  async webhooks(workflowId: string, userId: string): Promise<NodeWebhook[]> {
    const workflow = await this.ownedWorkflow(workflowId, userId);
    const definition = await this.repository.findDraftDefinition(workflow.id);
    const result: NodeWebhook[] = [];
    for (const node of definitionNodes(definition)) {
      const trigger = this.registry.trigger(node.key);
      if (!trigger) continue;
      const scope = trigger.webhook.scope;
      let credentialId: string | null = null;
      if (scope === 'credential') {
        const stored = await this.vault.findOwned(
          node.config[CREDENTIAL_FIELD],
          workflow.ownerId,
        );
        if (!stored || stored.connectorKey !== trigger.credentialType) {
          result.push({ nodeId: node.id, nodeKey: node.key, scope, url: null });
          continue;
        }
        credentialId = stored.id;
      }
      const endpoint = await this.registrar.ensureEndpoint(
        trigger,
        workflow.id,
        node.id,
        workflow.ownerId,
        credentialId,
      );
      result.push({
        nodeId: node.id,
        nodeKey: node.key,
        scope,
        url: webhookUrl(endpoint.id),
      });
    }
    return result;
  }

  async ownedWorkflow(
    workflowId: string,
    userId: string,
  ): Promise<WorkflowRef> {
    const workflow = await this.repository.findWorkflow(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.ownerId !== userId) {
      throw new ForbiddenException('You cannot change this workflow');
    }
    return workflow;
  }

  private async listen(workflow: WorkflowRef, versionId: string) {
    const definition = await this.repository.findVersionDefinition(versionId);
    const prepared: PreparedTrigger[] = [];
    for (const node of definitionNodes(definition)) {
      const trigger = this.registry.trigger(node.key);
      if (!trigger) continue;
      prepared.push(
        await this.registrar.prepare(
          trigger,
          node,
          workflow.id,
          workflow.ownerId,
        ),
      );
    }
    if (prepared.length === 0) {
      throw new BadRequestException(
        'This workflow has no trigger that listens for events. Add a Webhook or an app trigger, publish, then activate.',
      );
    }

    const previous = await this.repository.listenersOfWorkflow(workflow.id);
    const groups = new Map<string, PreparedTrigger[]>();
    for (const item of prepared) {
      groups.set(item.endpoint.id, [
        ...(groups.get(item.endpoint.id) ?? []),
        item,
      ]);
    }

    const touched: string[] = [];
    try {
      for (const [endpointId, items] of groups) {
        const others = (await this.repository.listenersOfEndpoint(endpointId))
          .filter((listener) => listener.workflowId !== workflow.id)
          .map((listener) => listener.parameters);
        touched.push(endpointId);
        await this.registrar.register(items[0], [
          ...others,
          ...items.map((item) => item.parameters),
        ]);
      }
    } catch (error) {
      // Nothing of this attempt stays registered unless someone else uses it.
      for (const endpointId of touched)
        await this.registrar.cleanup(endpointId);
      throw error;
    }

    const listeners: NewListener[] = prepared.map((item) => ({
      nodeId: item.node.id,
      nodeKey: item.trigger.key,
      endpointId: item.endpoint.id,
      credentialId: item.credentialId,
      parameters: item.parameters,
    }));
    await this.repository.replaceListeners(workflow.id, versionId, listeners);

    // Endpoints the previous version used and this one does not.
    for (const endpointId of new Set(previous.map((l) => l.endpointId))) {
      if (!groups.has(endpointId)) await this.registrar.cleanup(endpointId);
    }
  }

  private async stop(workflow: WorkflowRef) {
    const previous = await this.repository.listenersOfWorkflow(workflow.id);
    await this.repository.replaceListeners(workflow.id, null, []);
    await this.repository.setActive(workflow.id, false);
    for (const endpointId of new Set(previous.map((l) => l.endpointId))) {
      await this.registrar.cleanup(endpointId);
    }
  }
}

function stateOf(workflow: WorkflowRef): ActivationState {
  return {
    active: workflow.active,
    versionId: workflow.active ? workflow.currentVersionId : null,
  };
}
