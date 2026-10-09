import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConnectorModule } from '@app/connector';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthService } from './infrastructure/services/google-oauth.service';
import { GetGoogleAuthUrlHandler } from './application/queries/get-google-auth-url.query';
import { HandleGoogleCallbackHandler } from './application/commands/handle-google-callback.command';

const Handlers = [GetGoogleAuthUrlHandler, HandleGoogleCallbackHandler];

@Module({
  imports: [CqrsModule, ConnectorModule],
  controllers: [GoogleOauthController],
  providers: [GoogleOauthService, ...Handlers],
})
export class IntegrationsModule {}
