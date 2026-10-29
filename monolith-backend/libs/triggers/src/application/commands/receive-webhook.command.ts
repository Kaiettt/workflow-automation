import { WebhookRequest } from '../../domain/webhook-item';

export class ReceiveWebhookCommand {
  constructor(
    readonly token: string,
    readonly request: WebhookRequest,
    // Idempotency-Key header: the same key within 24h starts only one run.
    readonly idempotencyKey?: string,
  ) {}
}

export type ReceiveWebhookResult =
  | { executionId: string; duplicate: false }
  | { executionId: null; duplicate: true };

import { NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EnqueueExecutionCommand } from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';
import { WorkflowTriggerRepository } from '../../domain/workflow-trigger.repository';
import { TriggerChannel } from '../../domain/workflow-trigger';
import { buildWebhookItem } from '../../domain/webhook-item';
import { WebhookDedupPort } from '../ports/webhook-dedup.port';

const DEDUP_TTL_SECONDS = 24 * 60 * 60;

@CommandHandler(ReceiveWebhookCommand)
export class ReceiveWebhookHandler implements ICommandHandler<ReceiveWebhookCommand> {
  constructor(
    private readonly repository: WorkflowTriggerRepository,
    private readonly dedup: WebhookDedupPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: ReceiveWebhookCommand): Promise<ReceiveWebhookResult> {
    const trigger = await this.repository.findActive(
      TriggerChannel.WEBHOOK,
      command.token,
    );
    if (!trigger) throw new NotFoundException('Webhook not found');

    if (command.idempotencyKey) {
      const first = await this.dedup.claim(
        `dedup:webhook:${trigger.id}:${command.idempotencyKey}`,
        DEDUP_TTL_SECONDS,
      );
      if (!first) return { executionId: null, duplicate: true };
    }

    const executionId = await this.commandBus.execute<
      EnqueueExecutionCommand,
      string
    >(
      new EnqueueExecutionCommand(trigger.workflowVersionId, [
        buildWebhookItem(command.request, new Date()),
      ]),
    );
    return { executionId, duplicate: false };
  }
}
