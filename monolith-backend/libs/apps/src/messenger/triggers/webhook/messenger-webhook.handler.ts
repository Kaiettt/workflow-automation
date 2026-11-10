import { TriggerEvent, WebhookRequestContext } from '../../../core/package';
import { header, matchesKeywords } from '../../../core/text';
import { asText, parseMessengerEvents } from '../../utils/messenger-helpers';
import { isValidMetaSignature } from '../../utils/signature-validator';

export function handleMessengerWebhook({
  request,
  credential: secret,
  data,
}: WebhookRequestContext) {
  if (request.method === 'GET') {
    // Meta's check while the subscription is created.
    const expected = data.verify_token;
    const challenge = request.query['hub.challenge'];
    const ok =
      request.query['hub.mode'] === 'subscribe' &&
      typeof expected === 'string' &&
      expected !== '' &&
      request.query['hub.verify_token'] === expected;
    return ok
      ? {
          status: 200,
          contentType: 'text/plain',
          body: typeof challenge === 'string' ? challenge : '',
          events: [],
        }
      : { status: 403, body: { success: false }, events: [] };
  }
  const appSecret = secret?.client_secret;
  if (
    !isValidMetaSignature(
      request.rawBody,
      header(request.headers, 'x-hub-signature-256'),
      typeof appSecret === 'string' ? appSecret : undefined,
    )
  ) {
    return {
      status: 401,
      body: { success: false, message: 'Invalid signature' },
      events: [],
    };
  }
  return { status: 200, events: parseMessengerEvents(request.body) };
}

export function acceptsMessengerEvent(
  event: TriggerEvent,
  parameters: Record<string, unknown>,
): boolean {
  const wanted = parameters.events;
  const type = asText(event.json.type);
  return (
    event.json.page_id === parameters.page_id &&
    (wanted === undefined || wanted === 'all' || wanted === type) &&
    (matchesKeywords(asText(event.json.text), parameters.keywords) ||
      matchesKeywords(asText(event.json.payload), parameters.keywords))
  );
}
