import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GoogleOauthService } from '../../infrastructure/services/google-oauth.service';

export class HandleGoogleCallbackCommand {
  constructor(
    public readonly code: string,
    public readonly state: string,
  ) {}
}

@CommandHandler(HandleGoogleCallbackCommand)
export class HandleGoogleCallbackHandler implements ICommandHandler<HandleGoogleCallbackCommand> {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  async execute(command: HandleGoogleCallbackCommand): Promise<string> {
    return this.googleOauthService.handleCallback(command.code, command.state);
  }
}
