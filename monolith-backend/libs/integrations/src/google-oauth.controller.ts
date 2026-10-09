import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { GetGoogleAuthUrlQuery } from './application/queries/get-google-auth-url.query';
import { HandleGoogleCallbackCommand } from './application/commands/handle-google-callback.command';

@Controller('api/integrations/google')
export class GoogleOauthController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  async auth(@Req() req: Request & { user?: { id?: string } }) {
    const userId = req.user?.id || 'unknown';

    const url = String(
      await this.queryBus.execute(new GetGoogleAuthUrlQuery(userId)),
    );

    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.status(400).send('Code or state is missing');
    }

    const credentialId = String(
      await this.commandBus.execute(
        new HandleGoogleCallbackCommand(code, state),
      ),
    );

    res.send(`
      <script>
        window.opener.postMessage({ type: 'oauth-success', credentialId: '${credentialId}' }, '*');
        window.close();
      </script>
    `);
  }
}
