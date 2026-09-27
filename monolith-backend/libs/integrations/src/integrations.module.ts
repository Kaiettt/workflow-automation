import { Module } from '@nestjs/common';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthService } from './google-oauth.service';
import { PrismaModule } from '@app/database';

@Module({
  imports: [PrismaModule],
  controllers: [GoogleOauthController],
  providers: [GoogleOauthService],
})
export class IntegrationsModule {}
