import {
  Injectable,
  BadRequestException,
  ConflictException,
  HttpException,
  Optional,
} from '@nestjs/common';
import { google } from 'googleapis';
import { EncryptionUtil } from '@app/shared/utils/encryption.util';
import { ConnectorCredentialRepository } from '@app/connector/domain/repositories/connector-credential.repository';
import { ConnectorRepository } from '@app/connector/domain/repositories/connector.repository';
import { ConnectorCredential } from '@app/connector/domain/entities/connector-credential.entity';
import { ConnectorPolicyPort } from '@app/connector/application/ports/connector-policy.port';
import { PrismaService } from '@app/database';

@Injectable()
export class GoogleOauthService {
  private oauth2Client: any;

  constructor(
    private credentialRepo: ConnectorCredentialRepository,
    private connectorRepo: ConnectorRepository,
    @Optional() private policyPort?: ConnectorPolicyPort,
    @Optional() private prisma?: PrismaService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env['google-Client-Id'],
      process.env['google-Client-secret'],
      process.env['GOOGLE_REDIRECT_URI'],
    );
  }

  private async getGoogleConnectorId(): Promise<string> {
    const connector = await this.connectorRepo.findByKey('google');
    if (!connector) {
      // In case we have gmail/google_sheet etc, maybe we should fetch gmail?
      // User specifically requested key = 'google'
      throw new BadRequestException('Google connector not found in database');
    }
    return connector.id;
  }

  async getAuthUrl(userId: string): Promise<string> {
    const connectorId = await this.getGoogleConnectorId();
    if (this.policyPort) {
      await this.policyPort.assertCanCreateCredential(connectorId);
    }

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

  async handleCallback(code: string, state: string): Promise<string> {
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
      const tokensRecord = tokens as Record<string, string>;

      const encryptionKey = process.env['ENCRYPTION_KEY'];
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY is not defined');
      }

      if (!tokensRecord['refresh_token']) {
        throw new BadRequestException('No refresh token provided by Google');
      }

      const encryptedSecret = EncryptionUtil.encrypt(
        JSON.stringify(tokens),
        encryptionKey,
      );

      const connectorId = await this.getGoogleConnectorId();
      if (this.policyPort) {
        await this.policyPort.assertCanCreateCredential(connectorId);
      }

      if (this.prisma) {
        const saved = await this.prisma.$transaction(async (tx) => {
          const policy = await tx.connectorPolicy.findUnique({
            where: { connectorId },
          });
          const isAllowed = policy ? policy.allowNewCredentials : true;
          if (!isAllowed) {
            throw new ConflictException({
              code: 'CONNECTOR_NEW_CREDENTIALS_DISABLED',
              message:
                'New credentials for this connector have been disabled by platform administrator',
            });
          }
          return tx.connectorCredential.create({
            data: {
              connectorId,
              ownerId: userId,
              name: 'google-credential',
              encryptedSecret,
            },
          });
        });
        return saved.id;
      }

      const credential = new ConnectorCredential(
        undefined,
        connectorId,
        userId,
        'google-credential',
        encryptedSecret,
      );

      const savedCredential = await this.credentialRepo.create(credential);

      return savedCredential.id!;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to exchange auth code or save credential',
      );
    }
  }
}
