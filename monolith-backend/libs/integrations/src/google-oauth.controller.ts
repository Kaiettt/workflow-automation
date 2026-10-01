import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { GoogleOauthService } from './google-oauth.service';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';

@Controller('api/integrations/google')
export class GoogleOauthController {
  constructor(private googleOauthService: GoogleOauthService) {}

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  auth(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id || 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const url = this.googleOauthService.getAuthUrl(userId);
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

    const credentialId = await this.googleOauthService.handleCallback(
      code,
      state,
    );

    res.send(`
      <script>
        window.opener.postMessage({ type: 'oauth-success', credentialId: '${credentialId}' }, '*');
        window.close();
      </script>
    `);
  }
}
