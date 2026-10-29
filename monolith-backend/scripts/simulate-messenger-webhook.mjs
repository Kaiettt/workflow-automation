// Sends a Messenger message to the local backend the way Meta does (signed
// with META_APP_SECRET), to test a Messenger workflow without Facebook.
//
//   node scripts/simulate-messenger-webhook.mjs --page <PAGE_ID> --text "Hello"
//
// Options: --page (required, the Page ID of the credential), --text,
// --sender (customer id, default "test-customer"), --url (default
// http://localhost:$PORT/api/webhooks/messenger). Reads .env like the server.
// Replies are really sent to Facebook unless the customer id is fake, in which
// case the send node fails with a Graph API error: that is expected here.
import { createHmac, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const { values } = parseArgs({
  options: {
    page: { type: 'string' },
    text: { type: 'string', default: 'Xin chào shop!' },
    sender: { type: 'string', default: 'test-customer' },
    url: { type: 'string' },
  },
});

const secret = process.env.META_APP_SECRET;
if (!values.page || !secret) {
  console.error('Usage: --page <PAGE_ID> [--text ...]; META_APP_SECRET must be set in .env');
  process.exit(1);
}

const url =
  values.url ?? `http://localhost:${process.env.PORT ?? 8080}/api/webhooks/messenger`;
const now = Date.now();
const raw = JSON.stringify({
  object: 'page',
  entry: [
    {
      id: values.page,
      time: now,
      messaging: [
        {
          sender: { id: values.sender },
          recipient: { id: values.page },
          timestamp: now,
          message: { mid: `m_sim_${randomUUID()}`, text: values.text },
        },
      ],
    },
  ],
});
const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
  body: raw,
});
console.log(response.status, await response.text());
