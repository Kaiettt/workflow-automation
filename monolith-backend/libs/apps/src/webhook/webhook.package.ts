import {
  IntegrationPackage,
  TriggerNode,
  WebhookRequest,
} from '../core/package';
import { header } from '../core/text';

// Credentials of the caller must not end up in execution logs.
const HIDDEN_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
]);

// Any system that can send an HTTP POST. Each node has its own secret URL,
// which is the only credential.
export const webhookTrigger: TriggerNode = {
  kind: 'trigger',
  key: 'webhook.trigger',
  displayName: 'Webhook',
  description: 'Start when an HTTP POST arrives at this node’s URL',
  icon: 'webhook',
  color: '#6366F1',
  properties: [],
  webhook: {
    scope: 'node',
    handle({ request }) {
      if (request.method !== 'POST') {
        return {
          status: 405,
          body: { success: false, message: 'Send a POST request' },
          events: [],
        };
      }
      const idempotencyKey = header(request.headers, 'idempotency-key')?.trim();
      return {
        status: 202,
        events: [
          {
            ...(idempotencyKey ? { id: idempotencyKey } : {}),
            json: webhookJson(request, new Date()),
          },
        ],
      };
    },
  },
};

export function webhookJson(
  request: WebhookRequest,
  receivedAt: Date,
): Record<string, unknown> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HIDDEN_HEADERS.has(name.toLowerCase())) continue;
    headers[name.toLowerCase()] = Array.isArray(value)
      ? value.join(', ')
      : value;
  }
  return {
    body: request.body ?? null,
    query: request.query,
    headers,
    received_at: receivedAt.toISOString(),
  };
}

export const webhookPackage: IntegrationPackage = {
  key: 'webhook',
  displayName: 'Webhook',
  credentials: [],
  nodes: [webhookTrigger],
};
