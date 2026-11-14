import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AccountAdministrationPort } from '../ports/account-administration.port';
import type { AccountChange } from '../ports/account-administration.port';

export class ManageAccountCommand {
  constructor(readonly change: AccountChange) {}
}

@CommandHandler(ManageAccountCommand)
export class ManageAccountHandler implements ICommandHandler<ManageAccountCommand> {
  constructor(private readonly accounts: AccountAdministrationPort) {}
  execute(command: ManageAccountCommand) {
    return this.accounts.change(command.change);
  }
}
