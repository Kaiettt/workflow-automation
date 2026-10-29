import { OAuth2Service } from '@app/integrations/application/oauth2.service';
import { OauthStateStore } from '@app/integrations/application/ports/oauth-state.store';
import { CheckPublishTriggersHandler } from '@app/triggers/application/queries/check-publish-triggers.handler';
import { CheckPublishTriggersQuery } from '@app/designer/application/queries/check-publish-triggers.query';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';
import {
  definition,
  LLM_CREDENTIAL_ID,
  MemoryVault,
  MESSENGER_CREDENTIAL_ID,
  node,
  OWNER,
  testRegistry,
} from '@test/support/triggers/memory-triggers';

class MemoryStates extends OauthStateStore {
  states = new Map<string, string>();
  save(state: string, value: string) {
    this.states.set(state, value);
    return Promise.resolve();
  }
  take(state: string) {
    const value = this.states.get(state) ?? null;
    this.states.delete(state);
    return Promise.resolve(value);
  }
}

describe('OAuth2 credentials', () => {
  const previousBase = process.env['PUBLIC_BASE_URL'];
  let graph: FakeMetaGraph;
  let vault: MemoryVault;
  let states: MemoryStates;
  let service: OAuth2Service;

  beforeEach(() => {
    process.env['PUBLIC_BASE_URL'] = 'https://flow.test/';
    graph = new FakeMetaGraph();
    vault = new MemoryVault();
    // A credential just saved from the form: App ID / Secret, no token yet.
    vault.credentials.get(MESSENGER_CREDENTIAL_ID)!.secret = {
      client_id: 'app-1',
      client_secret: 'app-secret',
    };
    states = new MemoryStates();
    service = new OAuth2Service(testRegistry(graph), vault.asVault(), states);
  });

  afterEach(() => {
    if (previousBase === undefined) delete process.env['PUBLIC_BASE_URL'];
    else process.env['PUBLIC_BASE_URL'] = previousBase;
  });

  it('signs in with the user’s own app and stores the tokens in the credential', async () => {
    const url = new URL(
      await service.authorizationUrl(MESSENGER_CREDENTIAL_ID, OWNER),
    );
    expect(url.origin + url.pathname).toBe(
      'https://www.facebook.com/v23.0/dialog/oauth',
    );
    expect(url.searchParams.get('client_id')).toBe('app-1');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://flow.test/api/oauth2/callback',
    );
    expect(url.searchParams.get('scope')).toBe(
      'pages_show_list,pages_messaging,pages_manage_metadata',
    );

    const state = url.searchParams.get('state')!;
    expect(await service.handleCallback('code-1', state)).toBe(
      MESSENGER_CREDENTIAL_ID,
    );
    expect(
      vault.credentials.get(MESSENGER_CREDENTIAL_ID)!.secret,
    ).toMatchObject({
      client_id: 'app-1',
      client_secret: 'app-secret',
      access_token: 'long-short-token-for-code-1',
      pages: [{ id: 'page-1', name: 'Shop ABC', access_token: 'EAApage1' }],
    });

    // The state works once.
    await expect(service.handleCallback('code-1', state)).rejects.toThrow(
      'expired',
    );
  });

  it('only for the owner’s OAuth2 credentials', async () => {
    await expect(
      service.authorizationUrl(MESSENGER_CREDENTIAL_ID, 'intruder'),
    ).rejects.toThrow('Credential not found');
    await expect(
      service.authorizationUrl(LLM_CREDENTIAL_ID, OWNER),
    ).rejects.toThrow('does not use OAuth2');
  });
});

describe('publish check of package credentials', () => {
  it('reports a missing or foreign credential', async () => {
    const handler = new CheckPublishTriggersHandler(
      testRegistry(),
      new MemoryVault().asVault(),
    );
    const issues = await handler.execute(
      new CheckPublishTriggersQuery(
        'wf',
        OWNER,
        definition(
          node('ok', 'messenger.trigger', {
            credential_id: MESSENGER_CREDENTIAL_ID,
          }),
          node('wrong', 'messenger.sendMessage', {
            credential_id: LLM_CREDENTIAL_ID,
          }),
          node('gone', 'messenger.sendMessage', {
            credential_id: '55555555-5555-5555-5555-000000000000',
          }),
          node('hook', 'webhook.trigger'),
        ),
      ),
    );
    expect(issues.map((i) => [i.nodeId, i.code, i.message])).toEqual([
      [
        'wrong',
        'INVALID_CREDENTIAL',
        'The selected credential belongs to another app.',
      ],
      [
        'gone',
        'INVALID_CREDENTIAL',
        'The selected credential no longer exists. Pick another one.',
      ],
    ]);
  });
});
