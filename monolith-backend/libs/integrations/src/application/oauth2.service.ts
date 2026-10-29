import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PackageRegistry } from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { oauth2RedirectUrl } from '@app/shared/utils/public-base-url';
import { OauthStateStore } from './ports/oauth-state.store';

const STATE_TTL_SECONDS = 600;

interface StatePayload {
  userId: string;
  credentialId: string;
}

// OAuth2 for every credential type a package declares with `oauth2`: the
// client id / secret are the user's own (typed into the credential), the
// tokens end up in the same credential.
@Injectable()
export class OAuth2Service {
  constructor(
    private readonly registry: PackageRegistry,
    private readonly vault: CredentialVault,
    private readonly states: OauthStateStore,
  ) {}

  async authorizationUrl(
    credentialId: string,
    userId: string,
  ): Promise<string> {
    const { credential, oauth2 } = await this.load(credentialId, userId);
    const clientId = credential.secret.client_id;
    if (typeof clientId !== 'string' || !clientId) {
      throw new BadRequestException('Enter the client (App) ID first');
    }
    const state = randomBytes(24).toString('base64url');
    const payload: StatePayload = { userId, credentialId: credential.id };
    await this.states.save(state, JSON.stringify(payload), STATE_TTL_SECONDS);

    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauth2RedirectUrl(),
      state,
      response_type: 'code',
      scope: oauth2.scopes.join(oauth2.scopeSeparator ?? ' '),
    });
    return `${oauth2.authorizationUrl}?${query.toString()}`;
  }

  // Exchanges the code and stores the tokens in the credential the sign-in
  // was started for. Returns that credential's id.
  async handleCallback(code: string, state: string): Promise<string> {
    const raw = await this.states.take(state);
    if (!raw) {
      throw new BadRequestException(
        'This sign-in link has expired. Close the window and try again.',
      );
    }
    const payload = JSON.parse(raw) as StatePayload;
    const { credential, oauth2 } = await this.load(
      payload.credentialId,
      payload.userId,
    );
    const tokens = await oauth2.exchangeCode({
      code,
      redirectUri: oauth2RedirectUrl(),
      values: credential.secret,
    });
    await this.vault.updateSecret(credential.id, {
      ...credential.secret,
      ...tokens,
      connected_at: new Date().toISOString(),
    });
    return credential.id;
  }

  private async load(credentialId: string, userId: string) {
    const credential = await this.vault.findOwned(credentialId, userId);
    if (!credential) throw new NotFoundException('Credential not found');
    const oauth2 = this.registry.credentialType(
      credential.connectorKey,
    )?.oauth2;
    if (!oauth2) {
      throw new BadRequestException('This credential does not use OAuth2');
    }
    return { credential, oauth2 };
  }
}
