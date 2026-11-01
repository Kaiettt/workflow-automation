import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import {
  frontendOrigin,
  publicBaseUrl,
} from '@app/shared/utils/public-base-url';
import { OAuth2Service } from './application/oauth2.service';

class CompleteOAuth2Dto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  state!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  code!: string;
}

@ApiTags('integrations')
@Controller('api/oauth2')
export class OAuth2Controller {
  constructor(private readonly oauth2: OAuth2Service) {}

  @Get('auth')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Authorization URL of an OAuth2 credential' })
  async auth(
    @Query('credentialId', ParseUUIDPipe) credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { url, state } = await this.oauth2.authorizationUrl(
      credentialId,
      user.id,
    );
    // The designer accepts the callback's message only from this origin and
    // with this state.
    return { url, state, callbackOrigin: new URL(publicBaseUrl()).origin };
  }

  // The provider redirects the pop-up here. Nothing is stored: the page hands
  // the code to the designer window (and only to it), which completes the
  // sign-in with its own login, then closes.
  @Get('callback')
  callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error_description') denied?: string,
  ) {
    if (!code || !state) {
      res.status(400).send(
        popupPage({
          type: 'oauth2-callback',
          status: 'error',
          state: state ?? null,
          message: denied || 'Sign-in was cancelled',
        }),
      );
      return;
    }
    res.send(
      popupPage({ type: 'oauth2-callback', status: 'success', state, code }),
    );
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Store the tokens of a sign-in the current user started',
  })
  async complete(
    @Body() body: CompleteOAuth2Dto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const credentialId = await this.oauth2.complete(
      body.code,
      body.state,
      user.id,
    );
    return { success: true, data: { credentialId } };
  }
}

function popupPage(message: Record<string, unknown>): string {
  // "<" escaped so neither value can close the script tag.
  const payload = JSON.stringify(message).replace(/</g, '\\u003c');
  const target = JSON.stringify(frontendOrigin()).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><script>
  if (window.opener) window.opener.postMessage(${payload}, ${target});
  window.close();
</script><p>You can close this window.</p>`;
}
