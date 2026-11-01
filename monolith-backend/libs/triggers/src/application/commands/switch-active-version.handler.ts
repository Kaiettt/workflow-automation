import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  SwitchActiveVersionCommand,
  SwitchActiveVersionResult,
} from '@app/designer/application/commands/switch-active-version.command';
import { ActivationService } from '../activation.service';

@CommandHandler(SwitchActiveVersionCommand)
export class SwitchActiveVersionHandler implements ICommandHandler<SwitchActiveVersionCommand> {
  constructor(private readonly activation: ActivationService) {}

  execute(
    command: SwitchActiveVersionCommand,
  ): Promise<SwitchActiveVersionResult> {
    return this.activation.switchVersion(command.workflowId);
  }
}
