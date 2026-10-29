import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CREDENTIAL_FIELD,
  nodeParameters,
  PackageRegistry,
  TriggerNode,
} from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { webhookUrl } from '@app/shared/utils/public-base-url';
import { TriggerRepository } from '../domain/trigger.repository';
import { scopeKeyOf, WebhookEndpoint } from '../domain/trigger.types';
import { DefinitionNode } from '../domain/definition-nodes';
import { TestEventStore } from './ports/test-event.store';

// A trigger node ready to listen: its endpoint, decrypted credential and
// parameters.
export interface PreparedTrigger {
  node: DefinitionNode;
  trigger: TriggerNode;
  endpoint: WebhookEndpoint;
  credentialId: string | null;
  credential: Record<string, unknown> | null;
  parameters: Record<string, unknown>;
}

// Endpoints and their registration with the outside app (the package's
// checkExists / create / delete). No app-specific code here.
@Injectable()
export class EndpointRegistrar {
  private readonly logger = new Logger(EndpointRegistrar.name);

  constructor(
    private readonly registry: PackageRegistry,
    private readonly repository: TriggerRepository,
    private readonly vault: CredentialVault,
    private readonly tests: TestEventStore,
  ) {}

  // Checks the node's credential and finds or creates its endpoint.
  async prepare(
    trigger: TriggerNode,
    node: DefinitionNode,
    workflowId: string,
    ownerId: string,
  ): Promise<PreparedTrigger> {
    let credentialId: string | null = null;
    let credential: Record<string, unknown> | null = null;
    if (trigger.credentialType) {
      const typeName =
        this.registry.credentialType(trigger.credentialType)?.displayName ??
        trigger.credentialType;
      const chosen = node.config[CREDENTIAL_FIELD];
      if (typeof chosen !== 'string' || chosen === '') {
        throw new BadRequestException(
          `"${node.name}": choose a ${typeName} credential.`,
        );
      }
      const stored = await this.vault.findOwned(chosen, ownerId);
      if (!stored) {
        throw new BadRequestException(
          `"${node.name}": the selected credential no longer exists.`,
        );
      }
      if (stored.connectorKey !== trigger.credentialType) {
        throw new BadRequestException(
          `"${node.name}": the selected credential is not a ${typeName}.`,
        );
      }
      credentialId = stored.id;
      credential = stored.secret;
    }

    const endpoint = await this.ensureEndpoint(
      trigger,
      workflowId,
      node.id,
      ownerId,
      credentialId,
    );
    return {
      node,
      trigger,
      endpoint,
      credentialId,
      credential,
      parameters: nodeParameters(node.config),
    };
  }

  async ensureEndpoint(
    trigger: TriggerNode,
    workflowId: string,
    nodeId: string,
    ownerId: string,
    credentialId: string | null,
  ): Promise<WebhookEndpoint> {
    const scope = trigger.webhook.scope;
    const scopeKey = scopeKeyOf(scope, workflowId, nodeId, credentialId);
    return (
      (await this.repository.findEndpointByScope(scopeKey)) ??
      (await this.repository.createEndpoint({
        scopeKey,
        nodeKey: trigger.key,
        workflowId: scope === 'node' ? workflowId : null,
        credentialId: scope === 'credential' ? credentialId : null,
        ownerId,
        data: trigger.webhook.initialData?.() ?? {},
      }))
    );
  }

  // Makes sure the app sends the endpoint's events for these listeners.
  // Throws (BadRequest) with the app's reason when it refuses.
  async register(
    prepared: PreparedTrigger,
    listeners: Array<Record<string, unknown>>,
  ): Promise<void> {
    const { trigger, endpoint, credential } = prepared;
    // The stored data may have changed since the endpoint was read.
    const current =
      (await this.repository.findEndpoint(endpoint.id)) ?? endpoint;
    const context = {
      url: webhookUrl(endpoint.id),
      credential,
      data: { ...current.data },
      listeners,
    };
    try {
      const exists = trigger.webhook.checkExists
        ? await trigger.webhook.checkExists(context)
        : false;
      if (!exists && trigger.webhook.create) {
        await trigger.webhook.create(context);
      }
    } catch (error) {
      throw new BadRequestException(
        `"${prepared.node.name}": ${
          error instanceof Error ? error.message : 'the app refused the webhook'
        }`,
      );
    }
    await this.repository.updateEndpoint(endpoint.id, {
      data: context.data,
      registered: true,
    });
  }

  // Unregisters an endpoint nobody listens on any more (no listener, no test
  // waiting). Failures are logged only: the workflow is off either way.
  async cleanup(endpointId: string): Promise<void> {
    try {
      const endpoint = await this.repository.findEndpoint(endpointId);
      if (!endpoint?.registered) return;
      const [listeners, tests] = await Promise.all([
        this.repository.listenersOfEndpoint(endpointId),
        this.tests.waitingFor(endpointId),
      ]);
      if (listeners.length > 0 || tests.length > 0) return;

      const trigger = this.registry.trigger(endpoint.nodeKey);
      const context = {
        url: webhookUrl(endpoint.id),
        credential: endpoint.credentialId
          ? ((await this.vault.find(endpoint.credentialId))?.secret ?? null)
          : null,
        data: { ...endpoint.data },
        listeners: [],
      };
      if (trigger?.webhook.delete) {
        try {
          await trigger.webhook.delete(context);
        } catch (error) {
          this.logger.warn(
            `Could not unregister webhook ${endpointId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      await this.repository.updateEndpoint(endpointId, {
        data: context.data,
        registered: false,
      });
    } catch (error) {
      this.logger.error(
        `Cleaning up webhook ${endpointId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
