import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NodeTypePolicyPort } from '../ports/node-type-policy.port';
import {
  ChangeNodeTypeStatusParams,
  NodeTypePolicySnapshot,
} from '../../domain/node-type-policy';

export class ChangeNodeTypeStatusCommand {
  constructor(readonly params: ChangeNodeTypeStatusParams) {}
}
@CommandHandler(ChangeNodeTypeStatusCommand)
export class ChangeNodeTypeStatusHandler implements ICommandHandler<ChangeNodeTypeStatusCommand> {
  constructor(private readonly policy: NodeTypePolicyPort) {}
  execute(
    command: ChangeNodeTypeStatusCommand,
  ): Promise<NodeTypePolicySnapshot> {
    return this.policy.changeStatus(command.params);
  }
}
