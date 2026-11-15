import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ChangeConnectorPolicyParams,
  ConnectorPolicyPort,
  ConnectorPolicySnapshot,
} from '../ports/connector-policy.port';

export class ChangeConnectorPolicyCommand {
  constructor(readonly params: ChangeConnectorPolicyParams) {}
}

@CommandHandler(ChangeConnectorPolicyCommand)
export class ChangeConnectorPolicyHandler implements ICommandHandler<ChangeConnectorPolicyCommand> {
  constructor(private readonly policyPort: ConnectorPolicyPort) {}

  execute(
    command: ChangeConnectorPolicyCommand,
  ): Promise<ConnectorPolicySnapshot> {
    return this.policyPort.changePolicy(command.params);
  }
}
