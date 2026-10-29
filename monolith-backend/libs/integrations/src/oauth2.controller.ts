import {
  Controller,
  Get,
  HttpException,
  Logger,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { OAuth2Service } from './application/oauth2.service';

@ApiTags('integrations')
@Controller('api/oauth2')
export class OAuth2Controller {
  private readonly logger = new Logger(OAuth2Controller.name);

  constructor(private readonly oauth2: OAuth2Service) {}

  @Get('auth')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Authorization URL of an OAuth2 credential' })
  async auth(
    @Query('credentialId', ParseUUIDPipe) credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { url: await this.oauth2.authorizationUrl(credentialId, user.id) };
  }

  // The provider redirects the pop-up here; the page reports back to the
  // designer window and closes.
  @Get('callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error_description') denied?: string,
  ) {
    try {
      if (!code || !state) {
        throw new Error(denied || 'Sign-in was cancelled');
      }
      const credentialId = await this.oauth2.handleCallback(code, state);
      res.send(
        popupPage({ type: 'oauth2-callback', status: 'success', credentialId }),
      );
    } catch (error) {
      const message =
        error instanceof HttpException || error instanceof Error
          ? error.message
          : 'Connecting the account failed';
      this.logger.warn(`OAuth2 callback failed: ${message}`);
      res
        .status(400)
        .send(popupPage({ type: 'oauth2-callback', status: 'error', message }));
    }
  }
}

function popupPage(message: Record<string, unknown>): string {
  // "<" escaped so the payload cannot close the script tag.
  const payload = JSON.stringify(message).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><script>
  if (window.opener) window.opener.postMessage(${payload}, '*');
  window.close();
</script><p>You can close this window.</p>`;
}
