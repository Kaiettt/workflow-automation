import { Module } from '@nestjs/common';
import {
  CommandHandler,
  CqrsModule,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import {
  SwitchActiveVersionCommand,
  SwitchActiveVersionResult,
} from '@app/designer/application/commands/switch-active-version.command';
import { CheckPublishTriggersQuery } from '@app/designer/application/queries/check-publish-triggers.query';

// What the triggers module answers for a workflow with nothing to listen on:
// no trigger issues, not active. For e2e apps that test the designer alone.
@CommandHandler(SwitchActiveVersionCommand)
class NotActiveHandler implements ICommandHandler<SwitchActiveVersionCommand> {
  execute(): Promise<SwitchActiveVersionResult> {
    return Promise.resolve(null);
  }
}

@QueryHandler(CheckPublishTriggersQuery)
class NoTriggerIssuesHandler implements IQueryHandler<CheckPublishTriggersQuery> {
  execute(): Promise<[]> {
    return Promise.resolve([]);
  }
}

@Module({
  imports: [CqrsModule],
  providers: [NotActiveHandler, NoTriggerIssuesHandler],
})
export class NoTriggersTestModule {}
