import { CredentialType, NodeProperty } from '../../core/package';
import { GRAPH_VERSION, MetaGraphApi } from '../meta-graph.api';
import { appOf, pagesOf, StoredPage } from '../utils/messenger-helpers';

export const MESSENGER_CREDENTIAL = 'facebookMessengerOAuth2';

export function createMessengerCredential(graph: MetaGraphApi): CredentialType {
  return {
    key: MESSENGER_CREDENTIAL,
    displayName: 'Facebook Messenger account',
    fields: [
      {
        name: 'client_id',
        displayName: 'App ID',
        description: 'Meta App dashboard → App settings → Basic',
      },
      { name: 'client_secret', displayName: 'App Secret', secret: true },
    ],
    oauth2: {
      authorizationUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
      // Read the user's Pages, send messages as them, subscribe them to the app.
      scopes: ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'],
      scopeSeparator: ',',
      async exchangeCode({ code, redirectUri, values }) {
        const { appId, appSecret } = appOf(values);
        const shortToken = await graph.exchangeCode(
          appId,
          appSecret,
          code,
          redirectUri,
        );
        const longLived = await graph.exchangeLongLived(
          appId,
          appSecret,
          shortToken,
        );
        const pages = await graph.listPages(longLived.token);
        if (pages.length === 0) {
          throw new Error(
            'No Facebook Page was shared. Connect again and select at least one Page.',
          );
        }
        return {
          access_token: longLived.token,
          token_expires_at: longLived.expiresIn
            ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString()
            : null,
          pages: pages.map((page): StoredPage => ({
            id: page.id,
            name: page.name,
            access_token: page.accessToken,
          })),
        };
      },
    },
  };
}

export const pageProperty: NodeProperty = {
  name: 'page_id',
  displayName: 'Page',
  type: 'options',
  required: true,
  description: 'Pages granted when the credential was connected',
  loadOptions: ({ credential: secret }) =>
    Promise.resolve(
      pagesOf(secret).map((page) => ({ value: page.id, label: page.name })),
    ),
};
