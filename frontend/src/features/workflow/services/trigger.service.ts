import { AxiosError } from 'axios';
import { triggerApi } from '../api/trigger.api';
import type { NodeWebhook, WebhookHint } from '../types/trigger.types';

export const triggerService = {
  activation: triggerApi.activation,
  webhooks: triggerApi.webhooks,
  startTestListen: triggerApi.startTestListen,
  testListen: triggerApi.testListen,
  stopTestListen: triggerApi.stopTestListen,
  loadOptions: triggerApi.loadOptions,
  oauth2Url: triggerApi.oauth2Url,

  // Turning the switch on fails with the server's reason (e.g. Meta refused
  // the webhook); that reason is what the user needs to read.
  async setActive(workflowId: string, active: boolean) {
    try {
      return await triggerApi.setActive(workflowId, active);
    } catch (error) {
      throw new Error(errorMessage(error, 'The workflow could not be switched'), {
        cause: error,
      });
    }
  },

  findForNode: (webhooks: NodeWebhook[] | undefined, nodeId: string) =>
    webhooks?.find((webhook) => webhook.nodeId === nodeId),

  // x-webhook of a node type: the node receives events from outside.
  webhookHint(configSchema: unknown): WebhookHint | null {
    const hint = (configSchema as { 'x-webhook'?: unknown } | null | undefined)?.['x-webhook'];
    if (typeof hint !== 'object' || hint === null) return null;
    const scope = (hint as { scope?: unknown }).scope;
    return scope === 'node' || scope === 'credential' ? { scope } : null;
  },
};

// The `message` of a Nest error response, else the fallback.
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string' && message) return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
