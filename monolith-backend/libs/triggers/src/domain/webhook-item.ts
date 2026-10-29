// Credentials of the caller must not end up in execution logs.
const HIDDEN_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
]);

export interface WebhookRequest {
  body: unknown;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

// The single item a webhook call feeds into the workflow.
export function buildWebhookItem(
  request: WebhookRequest,
  receivedAt: Date,
): { json: Record<string, unknown> } {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HIDDEN_HEADERS.has(name.toLowerCase())) continue;
    headers[name.toLowerCase()] = Array.isArray(value)
      ? value.join(', ')
      : value;
  }
  return {
    json: {
      body: request.body ?? null,
      query: request.query,
      headers,
      received_at: receivedAt.toISOString(),
    },
  };
}
