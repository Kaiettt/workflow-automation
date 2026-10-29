import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConnectorModule } from '@app/connector';
import { AppsModule } from '@app/apps';
import { AuthModule } from '@app/auth';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthService } from './infrastructure/services/google-oauth.service';
import { GetGoogleAuthUrlHandler } from './application/queries/get-google-auth-url.query';
import { HandleGoogleCallbackHandler } from './application/commands/handle-google-callback.command';
import { OAuth2Controller } from './oauth2.controller';
import { OAuth2Service } from './application/oauth2.service';
import { NodeOptionsController } from './node-options.controller';
import { OauthStateStore } from './application/ports/oauth-state.store';
import { RedisOauthStateStore } from './infrastructure/services/redis-oauth-state.store';

const Handlers = [GetGoogleAuthUrlHandler, HandleGoogleCallbackHandler];

@Module({
  imports: [CqrsModule, ConnectorModule, AppsModule, AuthModule],
  controllers: [GoogleOauthController, OAuth2Controller, NodeOptionsController],
  providers: [
    GoogleOauthService,
    OAuth2Service,
    { provide: OauthStateStore, useClass: RedisOauthStateStore },
    ...Handlers,
  ],
})
export class IntegrationsModule {}
