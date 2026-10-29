import axios, { AxiosError } from 'axios';
import { AppApiError } from '../core/package';

export const GRAPH_VERSION = 'v23.0';
const REQUEST_TIMEOUT_MS = 15_000;

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export interface AppSubscription {
  object: string;
  callbackUrl: string;
  active: boolean;
}

// The Facebook Graph API calls the Messenger package makes; replaced by a fake
// in tests. The Meta App (id + secret) is the user's own, from the credential.
export interface MetaGraphApi {
  // OAuth: code → short-lived user token → long-lived user token.
  exchangeCode(
    appId: string,
    appSecret: string,
    code: string,
    redirectUri: string,
  ): Promise<string>;
  exchangeLongLived(
    appId: string,
    appSecret: string,
    userToken: string,
  ): Promise<{ token: string; expiresIn: number | null }>;
  // Pages the user granted, each with a Page token (never expires when it
  // comes from a long-lived user token).
  listPages(userToken: string): Promise<FacebookPage[]>;
  sendText(
    pageAccessToken: string,
    recipientId: string,
    text: string,
  ): Promise<{ messageId: string }>;
  // App webhook subscription (app token = "{app-id}|{app-secret}").
  listAppSubscriptions(
    appId: string,
    appToken: string,
  ): Promise<AppSubscription[]>;
  subscribeApp(
    appId: string,
    appToken: string,
    subscription: {
      callbackUrl: string;
      verifyToken: string;
      fields: string[];
    },
  ): Promise<void>;
  unsubscribeApp(appId: string, appToken: string): Promise<void>;
  // Which apps receive a Page's events.
  pageSubscribedAppIds(
    pageId: string,
    pageAccessToken: string,
  ): Promise<string[]>;
  subscribePage(pageId: string, pageAccessToken: string): Promise<void>;
  unsubscribePage(pageId: string, pageAccessToken: string): Promise<void>;
}

export class HttpMetaGraphApi implements MetaGraphApi {
  async exchangeCode(
    appId: string,
    appSecret: string,
    code: string,
    redirectUri: string,
  ) {
    const data = await this.call<{ access_token: string }>(
      'get',
      'oauth/access_token',
      {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    );
    return data.access_token;
  }

  async exchangeLongLived(appId: string, appSecret: string, userToken: string) {
    const data = await this.call<{ access_token: string; expires_in?: number }>(
      'get',
      'oauth/access_token',
      {
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'fb_exchange_token',
        fb_exchange_token: userToken,
      },
    );
    return { token: data.access_token, expiresIn: data.expires_in ?? null };
  }

  async listPages(userToken: string) {
    const data = await this.call<{
      data?: Array<{ id: string; name: string; access_token: string }>;
    }>('get', 'me/accounts', {
      access_token: userToken,
      fields: 'id,name,access_token',
      limit: 100,
    });
    return (data.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
    }));
  }

  async sendText(pageAccessToken: string, recipientId: string, text: string) {
    const data = await this.call<{ message_id?: string }>(
      'post',
      'me/messages',
      { access_token: pageAccessToken },
      {
        recipient: { id: recipientId },
        // A reply to a message the customer sent (allowed for 24 hours).
        messaging_type: 'RESPONSE',
        message: { text },
      },
    );
    return { messageId: data.message_id ?? '' };
  }

  async listAppSubscriptions(appId: string, appToken: string) {
    const data = await this.call<{
      data?: Array<{ object: string; callback_url: string; active: boolean }>;
    }>('get', `${appId}/subscriptions`, { access_token: appToken });
    return (data.data ?? []).map((subscription) => ({
      object: subscription.object,
      callbackUrl: subscription.callback_url,
      active: subscription.active,
    }));
  }

  async subscribeApp(
    appId: string,
    appToken: string,
    subscription: {
      callbackUrl: string;
      verifyToken: string;
      fields: string[];
    },
  ) {
    // Meta calls the callback URL (GET hub.challenge) before answering.
    await this.call('post', `${appId}/subscriptions`, {
      access_token: appToken,
      object: 'page',
      callback_url: subscription.callbackUrl,
      verify_token: subscription.verifyToken,
      fields: subscription.fields.join(','),
    });
  }

  async unsubscribeApp(appId: string, appToken: string) {
    await this.call('delete', `${appId}/subscriptions`, {
      access_token: appToken,
      object: 'page',
    });
  }

  async pageSubscribedAppIds(pageId: string, pageAccessToken: string) {
    const data = await this.call<{ data?: Array<{ id: string }> }>(
      'get',
      `${pageId}/subscribed_apps`,
      { access_token: pageAccessToken },
    );
    return (data.data ?? []).map((app) => app.id);
  }

  async subscribePage(pageId: string, pageAccessToken: string) {
    await this.call('post', `${pageId}/subscribed_apps`, {
      access_token: pageAccessToken,
      subscribed_fields: 'messages',
    });
  }

  async unsubscribePage(pageId: string, pageAccessToken: string) {
    await this.call('delete', `${pageId}/subscribed_apps`, {
      access_token: pageAccessToken,
    });
  }

  private async call<T>(
    method: 'get' | 'post' | 'delete',
    path: string,
    params: Record<string, unknown>,
    data?: unknown,
  ): Promise<T> {
    try {
      const response = await axios.request<T>({
        method,
        url: `https://graph.facebook.com/${GRAPH_VERSION}/${path}`,
        params,
        data,
        timeout: REQUEST_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      throw toAppApiError(error);
    }
  }
}

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
}

// Rate limits, timeouts and 5xx are retryable; Graph explains everything else.
export function toAppApiError(error: unknown): AppApiError {
  if (!(error instanceof AxiosError)) {
    return new AppApiError(
      error instanceof Error ? error.message : 'Facebook request failed',
      false,
    );
  }
  if (!error.response) {
    return new AppApiError(
      `Facebook did not answer (${error.code ?? 'network error'})`,
      true,
    );
  }

  const status = error.response.status;
  const graph = (error.response.data as { error?: GraphError } | undefined)
    ?.error;
  const code = graph?.code;
  if (code === 10 && graph?.error_subcode === 2018278) {
    return new AppApiError(
      'Messenger only allows replies within 24 hours of the customer’s last message',
      false,
    );
  }
  if (code === 551) {
    return new AppApiError(
      'This person is not available on Messenger right now',
      false,
    );
  }
  if (code === 190) {
    return new AppApiError(
      'The Facebook connection has expired; reconnect the credential',
      false,
    );
  }
  const rateLimited = code === 4 || code === 32 || code === 613;
  return new AppApiError(
    `Facebook API error (${status}): ${graph?.message ?? error.message}`,
    status === 429 || status >= 500 || rateLimited,
  );
}
