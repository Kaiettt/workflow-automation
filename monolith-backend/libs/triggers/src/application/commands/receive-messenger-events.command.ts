export class ReceiveMessengerEventsCommand {
  // `body` has already passed the Meta signature check.
  constructor(readonly body: unknown) {}
}

export interface ReceiveMessengerEventsResult {
  started: string[]; // execution ids
  ignored: number; // duplicates and messages to Pages nobody listens on
}

import { Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EnqueueExecutionCommand } from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';
import { WorkflowTriggerRepository } from '../../domain/workflow-trigger.repository';
import { TriggerChannel } from '../../domain/workflow-trigger';
import { parseMessengerMessages } from '../../domain/messenger-event';
import { WebhookDedupPort } from '../ports/webhook-dedup.port';

const DEDUP_TTL_SECONDS = 24 * 60 * 60;

// One execution per customer message. Meta retries deliveries it thinks failed,
// so a message id is processed once.
@CommandHandler(ReceiveMessengerEventsCommand)
export class ReceiveMessengerEventsHandler implements ICommandHandler<ReceiveMessengerEventsCommand> {
  private readonly logger = new Logger(ReceiveMessengerEventsHandler.name);

  constructor(
    private readonly repository: WorkflowTriggerRepository,
    private readonly dedup: WebhookDedupPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: ReceiveMessengerEventsCommand,
  ): Promise<ReceiveMessengerEventsResult> {
    const result: ReceiveMessengerEventsResult = { started: [], ignored: 0 };

    for (const message of parseMessengerMessages(command.body)) {
      const trigger = await this.repository.findActive(
        TriggerChannel.MESSENGER,
        message.pageId,
      );
      if (!trigger) {
        this.logger.debug(`No workflow listens on Page ${message.pageId}`);
        result.ignored += 1;
        continue;
      }
      const first = await this.dedup.claim(
        `dedup:messenger:${message.messageId}`,
        DEDUP_TTL_SECONDS,
      );
      if (!first) {
        result.ignored += 1;
        continue;
      }
      result.started.push(
        await this.commandBus.execute<EnqueueExecutionCommand, string>(
          new EnqueueExecutionCommand(trigger.workflowVersionId, [
            message.item,
          ]),
        ),
      );
    }
    return result;
  }
}
