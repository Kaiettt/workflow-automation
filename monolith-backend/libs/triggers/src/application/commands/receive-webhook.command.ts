import { Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PackageRegistry, TriggerEvent, WebhookRequest } from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { EnqueueExecutionCommand } from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';
import { TriggerRepository } from '../../domain/trigger.repository';
import { Listener, TestListen } from '../../domain/trigger.types';
import { WebhookDedupPort } from '../ports/webhook-dedup.port';
import { TestEventStore } from '../ports/test-event.store';

const DEDUP_TTL_SECONDS = 24 * 60 * 60;

export class ReceiveWebhookCommand {
  constructor(
    readonly endpointId: string,
    readonly request: WebhookRequest,
  ) {}
}

export type ReceiveWebhookResult =
  | { outcome: 'not-found' }
  | {
      outcome: 'handled';
      status: number;
      contentType?: string;
      body: unknown;
    };

// The one ingress for every package: the package handles the request
// (handshake, verification, parsing); every listener that accepts an event
// runs, each in its own execution. No app-specific code here.
@CommandHandler(ReceiveWebhookCommand)
export class ReceiveWebhookHandler implements ICommandHandler<ReceiveWebhookCommand> {
  private readonly logger = new Logger(ReceiveWebhookHandler.name);

  constructor(
    private readonly registry: PackageRegistry,
    private readonly repository: TriggerRepository,
    private readonly vault: CredentialVault,
    private readonly dedup: WebhookDedupPort,
    private readonly tests: TestEventStore,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: ReceiveWebhookCommand): Promise<ReceiveWebhookResult> {
    const endpoint = await this.repository.findEndpoint(command.endpointId);
    const trigger = this.registry.trigger(endpoint?.nodeKey);
    if (!endpoint || !trigger) return { outcome: 'not-found' };

    let credential: Record<string, unknown> | null = null;
    if (endpoint.credentialId) {
      const stored = await this.vault.findOwned(
        endpoint.credentialId,
        endpoint.ownerId,
      );
      if (!stored) return { outcome: 'not-found' };
      credential = stored.secret;
    }

    const result = await trigger.webhook.handle({
      request: command.request,
      credential,
      data: endpoint.data,
    });
    if (result.events.length === 0) {
      return {
        outcome: 'handled',
        status: result.status,
        contentType: result.contentType,
        body: result.body ?? {
          success: true,
          data: { started: [], ignored: 0 },
        },
      };
    }

    const [listeners, tests] = await Promise.all([
      this.repository.listenersOfEndpoint(endpoint.id),
      this.tests.waitingFor(endpoint.id),
    ]);
    // A per-node URL nobody listens on is the caller's mistake (or the
    // workflow is off): worth a 404. Shared URLs (one Meta App) keep acking.
    if (
      listeners.length === 0 &&
      tests.length === 0 &&
      trigger.webhook.scope === 'node'
    ) {
      return { outcome: 'not-found' };
    }

    const accepts = (
      event: TriggerEvent,
      parameters: Record<string, unknown>,
    ) => trigger.webhook.accepts?.(event, parameters) ?? true;
    const started: string[] = [];
    let ignored = 0;
    const pendingTests = [...tests];

    for (const event of result.events) {
      await this.deliverTests(pendingTests, event, accepts);

      const matching = listeners.filter((listener) =>
        accepts(event, listener.parameters),
      );
      if (matching.length === 0) {
        ignored += 1;
        continue;
      }
      if (
        event.id &&
        !(await this.dedup.claim(
          `dedup:${endpoint.id}:${event.id}`,
          DEDUP_TTL_SECONDS,
        ))
      ) {
        ignored += 1;
        continue;
      }
      started.push(...(await this.run(matching, event)));
    }

    return {
      outcome: 'handled',
      status: result.status,
      contentType: result.contentType,
      body: result.body ?? { success: true, data: { started, ignored } },
    };
  }

  // Each waiting test takes the first event it accepts, then stops.
  private async deliverTests(
    pending: TestListen[],
    event: TriggerEvent,
    accepts: (
      event: TriggerEvent,
      parameters: Record<string, unknown>,
    ) => boolean,
  ) {
    for (const listen of [...pending]) {
      if (!accepts(event, listen.parameters)) continue;
      pending.splice(pending.indexOf(listen), 1);
      await this.tests.save({
        ...listen,
        status: 'received',
        event: event.json,
      });
    }
  }

  private async run(listeners: Listener[], event: TriggerEvent) {
    const started: string[] = [];
    for (const listener of listeners) {
      try {
        started.push(
          await this.commandBus.execute<EnqueueExecutionCommand, string>(
            new EnqueueExecutionCommand(listener.workflowVersionId, [
              { json: event.json },
            ]),
          ),
        );
      } catch (error) {
        // One workflow failing to start must not stop the others.
        this.logger.error(
          `Could not start workflow ${listener.workflowId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return started;
  }
}
