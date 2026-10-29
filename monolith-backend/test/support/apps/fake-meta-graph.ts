// Facebook Graph API stand-in: records every call, keeps subscriptions in
// memory, and can be told to fail.
import type {
  AppSubscription,
  FacebookPage,
  MetaGraphApi,
} from '@app/apps/messenger/meta-graph.api';

export interface SentMessage {
  pageAccessToken: string;
  recipientId: string;
  text: string;
}

export class FakeMetaGraph implements MetaGraphApi {
  sent: SentMessage[] = [];
  exchanged: Array<{ appId: string; code: string; redirectUri: string }> = [];
  pages: FacebookPage[] = [
    { id: 'page-1', name: 'Shop ABC', accessToken: 'EAApage1' },
  ];
  // appId → subscription of the `page` object.
  appSubscriptions = new Map<
    string,
    AppSubscription & { verifyToken: string; appToken: string }
  >();
  // pageId → app ids receiving its events.
  pageApps = new Map<string, Set<string>>();
  // Called while subscribeApp runs, like Meta verifying the callback URL.
  onSubscribeApp?: (subscription: {
    callbackUrl: string;
    verifyToken: string;
  }) => Promise<void>;
  // Next subscribeApp call fails with this error.
  subscribeFailure: Error | null = null;
  calls: string[] = [];

  // Errors to throw from the next sendText calls, in order.
  constructor(private readonly sendFailures: Error[] = []) {}

  exchangeCode(
    appId: string,
    _appSecret: string,
    code: string,
    redirectUri: string,
  ) {
    this.exchanged.push({ appId, code, redirectUri });
    return Promise.resolve(`short-token-for-${code}`);
  }

  exchangeLongLived(_appId: string, _appSecret: string, userToken: string) {
    return Promise.resolve({
      token: `long-${userToken}`,
      expiresIn: 5_184_000,
    });
  }

  listPages() {
    return Promise.resolve(this.pages);
  }

  sendText(pageAccessToken: string, recipientId: string, text: string) {
    this.sent.push({ pageAccessToken, recipientId, text });
    const failure = this.sendFailures.shift();
    return failure
      ? Promise.reject(failure)
      : Promise.resolve({ messageId: `mid.${this.sent.length}` });
  }

  listAppSubscriptions(appId: string) {
    this.calls.push(`listAppSubscriptions ${appId}`);
    const subscription = this.appSubscriptions.get(appId);
    return Promise.resolve(subscription ? [subscription] : []);
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
    this.calls.push(`subscribeApp ${appId} ${subscription.callbackUrl}`);
    if (this.subscribeFailure) {
      const failure = this.subscribeFailure;
      this.subscribeFailure = null;
      throw failure;
    }
    await this.onSubscribeApp?.(subscription);
    this.appSubscriptions.set(appId, {
      object: 'page',
      callbackUrl: subscription.callbackUrl,
      active: true,
      verifyToken: subscription.verifyToken,
      appToken,
    });
  }

  unsubscribeApp(appId: string) {
    this.calls.push(`unsubscribeApp ${appId}`);
    this.appSubscriptions.delete(appId);
    return Promise.resolve();
  }

  pageSubscribedAppIds(pageId: string) {
    return Promise.resolve([...(this.pageApps.get(pageId) ?? [])]);
  }

  subscribePage(pageId: string, pageAccessToken: string) {
    this.calls.push(`subscribePage ${pageId} ${pageAccessToken}`);
    // The app is the one whose subscription exists (a single app in tests).
    const appIds = [...this.appSubscriptions.keys()];
    this.pageApps.set(pageId, new Set(appIds));
    return Promise.resolve();
  }

  unsubscribePage(pageId: string) {
    this.calls.push(`unsubscribePage ${pageId}`);
    this.pageApps.delete(pageId);
    return Promise.resolve();
  }
}
