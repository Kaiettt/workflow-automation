import { WebhookLifecycleContext } from '../../../core/package';
import { MetaGraphApi } from '../../meta-graph.api';
import {
  appTokenOf,
  asText,
  hasAll,
  listenedPages,
  pagesOf,
  stringList,
} from '../../utils/messenger-helpers';

export const SUBSCRIBED_FIELDS = ['messages', 'messaging_postbacks'];

export function createMessengerLifecycle(graph: MetaGraphApi) {
  return {
    async checkExists(context: WebhookLifecycleContext) {
      const { appId, appToken } = appTokenOf(context.credential);
      const subscriptions = await graph.listAppSubscriptions(appId, appToken);
      const subscribed = subscriptions.some(
        (s) =>
          s.object === 'page' &&
          s.callbackUrl === context.url &&
          s.active &&
          hasAll(s.fields, SUBSCRIBED_FIELDS),
      );
      if (!subscribed) return false;
      for (const page of listenedPages(context)) {
        const apps = await graph.pageSubscribedApps(page.id, page.access_token);
        const ours = apps.find((app) => app.id === appId);
        if (!ours || !hasAll(ours.fields, SUBSCRIBED_FIELDS)) return false;
      }
      return true;
    },

    async create(context: WebhookLifecycleContext) {
      const { appId, appToken } = appTokenOf(context.credential);
      await graph.subscribeApp(appId, appToken, {
        callbackUrl: context.url,
        verifyToken: asText(context.data.verify_token),
        fields: SUBSCRIBED_FIELDS,
      });
      const subscribed = new Set(stringList(context.data.pages));
      for (const page of listenedPages(context)) {
        await graph.subscribePage(
          page.id,
          page.access_token,
          SUBSCRIBED_FIELDS,
        );
        subscribed.add(page.id);
      }
      context.data.pages = [...subscribed];
    },

    async delete(context: WebhookLifecycleContext) {
      const { appId, appToken } = appTokenOf(context.credential);
      await graph.unsubscribeApp(appId, appToken);
      const pages = pagesOf(context.credential);
      for (const pageId of stringList(context.data.pages)) {
        const page = pages.find((candidate) => candidate.id === pageId);
        if (page) await graph.unsubscribePage(page.id, page.access_token);
      }
      context.data.pages = [];
    },
  };
}
