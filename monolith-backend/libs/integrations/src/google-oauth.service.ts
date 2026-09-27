import { Injectable, BadRequestException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '@app/database';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';

@Injectable()
export class GoogleOauthService {
  private oauth2Client: any;
  private readonly connectorId = '22222222-2222-2222-2222-222222222221';

  constructor(private prisma: PrismaService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env['google-Client-Id'],
      process.env['google-Client-secret'],
      process.env['GOOGLE_REDIRECT_URI'],
    );
  }

  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ];

    // Using state to pass the userId securely could be done by signing it,
    // but for MVP we encode the userId directly.
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    });
  }

  async handleCallback(code: string, state: string): Promise<void> {
    try {
      const decodedState: unknown = JSON.parse(
        Buffer.from(state, 'base64').toString('utf8'),
      );
      if (
        typeof decodedState !== 'object' ||
        decodedState === null ||
        !('userId' in decodedState) ||
        typeof decodedState.userId !== 'string' ||
        !decodedState.userId
      ) {
        throw new BadRequestException('Invalid state: missing userId');
      }
      const userId = decodedState.userId;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const { tokens } = await this.oauth2Client.getToken(code);
      const encryptionKey = process.env['ENCRYPTION_KEY'];
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY is not defined');
      }

      const encryptedSecret = EncryptionUtil.encrypt(
        JSON.stringify(tokens),
        encryptionKey,
      );

      await this.prisma.connectorCredential.create({
        data: {
          connectorId: this.connectorId,
          ownerId: userId,
          name: 'Google Account',
          encryptedSecret,
        },
      });
    } catch {
      throw new BadRequestException(
        'Failed to exchange auth code or save credential',
      );
    }
  }
}
