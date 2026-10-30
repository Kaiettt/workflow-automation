/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import {
  ActionNode,
  AppApiError,
  credentialConfigSchema,
  nodeConfigSchema,
} from '@app/apps';
import { createHttpPackage } from '@app/apps/http/http.package';
import {
  BlockedAddressError,
  HttpTransportError,
  SafeRequest,
  SafeResponse,
} from '@app/apps/http/safe-request';

const answer = (overrides: Partial<SafeResponse> = {}): SafeResponse => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: Buffer.from('{"id":7}'),
  url: 'https://api.test/',
  ...overrides,
});

function setup(reply: SafeResponse | Error = answer(), allowPrivate = false) {
  const calls: SafeRequest[] = [];
  const pkg = createHttpPackage({
    allowPrivate: () => allowPrivate,
    request: (request) => {
      calls.push(request);
      return reply instanceof Error
        ? Promise.reject(reply)
        : Promise.resolve(reply);
    },
  });
  const node = pkg.nodes[0] as ActionNode;
  const run = async (
    parameters: Record<string, unknown>,
    credential: Record<string, unknown> | null = null,
  ) =>
    (await node.execute({
      parameters: { url: 'https://api.test/orders', ...parameters },
      credential,
      item: { json: {} },
    })) as Record<string, any>;
  return { pkg, node, calls, run };
}

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected the call to fail');
};

describe('HTTP package', () => {
  describe('catalog schemas', () => {
    const { pkg, node } = setup();

    it('declares three optional credential types with hidden secrets', () => {
      expect(pkg.credentials.map((c) => c.key)).toEqual([
        'httpHeaderAuth',
        'httpBearerAuth',
        'httpBasicAuth',
      ]);
      const bearer = credentialConfigSchema(pkg.credentials[1]) as any;
      expect(bearer.properties.token['x-secret']).toBe(true);
      expect(bearer.required).toEqual(['token']);
    });

    it('picks the credential by the authentication field and hides it for "none"', () => {
      const schema = nodeConfigSchema(node) as any;
      expect(schema.required).toEqual(['url']);
      expect(schema.properties.credential_id).toMatchObject({
        'x-refType': 'credential',
        'x-connectorKeyFrom': 'authentication',
        'x-hideWhen': { field: 'authentication', in: ['none', ''] },
      });
      const order: string[] = schema['x-propertyOrder'];
      expect(order.indexOf('credential_id')).toBe(
        order.indexOf('authentication') + 1,
      );
      expect(schema.properties.authentication.default).toBe('none');
      expect(schema.properties.authentication.enum).toEqual([
        'none',
        'httpHeaderAuth',
        'httpBearerAuth',
        'httpBasicAuth',
      ]);
    });

    it('shows the body field for the body type only', () => {
      const schema = nodeConfigSchema(node) as any;
      expect(schema.properties.body['x-hideWhen']).toEqual({
        field: 'body_type',
        in: ['none', 'form'],
      });
      expect(schema.properties.form['x-hideWhen']).toEqual({
        field: 'body_type',
        in: ['none', 'json', 'raw'],
      });
      expect(schema.properties.query.type).toBe('array');
    });

    it('has no expression as the default of any field', () => {
      const schema = nodeConfigSchema(node) as any;
      const properties = Object.values(
        schema.properties as Record<string, { default?: unknown }>,
      );
      for (const { default: value } of properties) {
        if (typeof value === 'string') expect(value.includes('{{')).toBe(false);
      }
    });
  });

  describe('building the request', () => {
    it('adds query parameters to the ones already in the URL', async () => {
      const { calls, run } = setup();
      await run({
        url: 'https://api.test/orders?status=open',
        query: [
          { name: 'page', value: 2 },
          { name: 'q', value: 'a b&c' },
          { name: ' ', value: 'ignored' },
        ],
      });
      expect(calls[0].url).toBe(
        'https://api.test/orders?status=open&page=2&q=a+b%26c',
      );
      expect(calls[0].method).toBe('GET');
    });

    it('lowercases header names and refuses an invalid one', async () => {
      const { calls, run } = setup();
      await run({ headers: [{ name: 'X-Trace-Id', value: 'abc' }] });
      expect(calls[0].headers).toEqual({ 'x-trace-id': 'abc' });
      expect(
        (await failure(run({ headers: [{ name: 'bad header', value: 'x' }] })))
          .message,
      ).toContain('not a valid header name');
    });

    it('sends JSON written as text, and sets the content type unless the user did', async () => {
      const { calls, run } = setup();
      await run({ method: 'POST', body_type: 'json', body: '{"a": [1, 2]}' });
      expect(calls[0].body?.toString()).toBe('{"a":[1,2]}');
      expect(calls[0].headers['content-type']).toBe('application/json');

      await run({
        method: 'POST',
        body_type: 'json',
        body: '{}',
        headers: [{ name: 'Content-Type', value: 'application/vnd.api+json' }],
      });
      expect(calls[1].headers['content-type']).toBe('application/vnd.api+json');
    });

    it('sends the value of a single expression as JSON', async () => {
      const { calls, run } = setup();
      await run({
        method: 'PUT',
        body_type: 'json',
        body: { customer: { name: 'An' }, items: [1] },
      });
      expect(calls[0].body?.toString()).toBe(
        '{"customer":{"name":"An"},"items":[1]}',
      );
    });

    it('says when the JSON is not valid, and sends nothing for an empty body', async () => {
      const { calls, run } = setup();
      expect(
        (
          await failure(
            run({ method: 'POST', body_type: 'json', body: '{oops' }),
          )
        ).message,
      ).toBe('The body is not valid JSON');
      await run({ method: 'POST', body_type: 'json', body: '  ' });
      expect(calls[0].body).toBeUndefined();
    });

    it('sends form fields urlencoded', async () => {
      const { calls, run } = setup();
      await run({
        method: 'POST',
        body_type: 'form',
        form: [
          { name: 'email', value: 'a@b.c' },
          { name: 'note', value: 'x y' },
        ],
      });
      expect(calls[0].body?.toString()).toBe('email=a%40b.c&note=x+y');
      expect(calls[0].headers['content-type']).toBe(
        'application/x-www-form-urlencoded',
      );
    });

    it('sends raw text', async () => {
      const { calls, run } = setup();
      await run({ method: 'POST', body_type: 'raw', body: 'plain text' });
      expect(calls[0].body?.toString()).toBe('plain text');
      expect(calls[0].headers['content-type']).toContain('text/plain');
    });

    it('does not send a body with GET or HEAD', async () => {
      const { calls, run } = setup();
      await run({ method: 'GET', body_type: 'json', body: '{"a":1}' });
      await run({ method: 'head', body_type: 'raw', body: 'x' });
      expect(calls[0].body).toBeUndefined();
      expect(calls[1]).toMatchObject({ method: 'HEAD', body: undefined });
    });

    it('needs a valid URL and a known method', async () => {
      const { run } = setup();
      expect((await failure(run({ url: '  ' }))).message).toBe(
        'URL is required',
      );
      expect((await failure(run({ url: 'orders' }))).message).toContain(
        'not a valid URL',
      );
      expect((await failure(run({ method: 'TRACE' }))).message).toContain(
        'not a supported method',
      );
    });

    it('limits the timeout and the redirects it passes on', async () => {
      const { calls, run } = setup();
      await run({ timeout_ms: 600000 });
      await run({ timeout_ms: 5000 });
      await run({ timeout_ms: 'soon' });
      expect(calls.map((c) => c.timeoutMs)).toEqual([120000, 5000, 30000]);
      expect(calls[0]).toMatchObject({
        maxRedirects: 5,
        maxBytes: 5 * 1024 * 1024,
      });
    });

    it('passes the setting that allows private addresses', async () => {
      const closed = setup();
      await closed.run({});
      expect(closed.calls[0].allowPrivate).toBe(false);
      const open = setup(answer(), true);
      await open.run({});
      expect(open.calls[0].allowPrivate).toBe(true);
    });
  });

  describe('authentication', () => {
    it('sends nothing without authentication', async () => {
      const { calls, run } = setup();
      await run({ authentication: 'none' }, { token: 'ignored' });
      expect(calls[0].headers).toEqual({});
    });

    it('sends a bearer token', async () => {
      const { calls, run } = setup();
      await run({ authentication: 'httpBearerAuth' }, { token: 'tok-1' });
      expect(calls[0].headers.authorization).toBe('Bearer tok-1');
    });

    it('sends basic auth', async () => {
      const { calls, run } = setup();
      await run(
        { authentication: 'httpBasicAuth' },
        { user: 'an', password: 'p:w' },
      );
      expect(calls[0].headers.authorization).toBe(
        `Basic ${Buffer.from('an:p:w').toString('base64')}`,
      );
    });

    it("sends a key in a header of the credential's choosing", async () => {
      const { calls, run } = setup();
      await run(
        { authentication: 'httpHeaderAuth' },
        { name: 'X-API-Key', value: 'k' },
      );
      expect(calls[0].headers).toEqual({ 'x-api-key': 'k' });
    });

    it('lets the credential win over a header typed by hand', async () => {
      const { calls, run } = setup();
      await run(
        {
          authentication: 'httpBearerAuth',
          headers: [{ name: 'Authorization', value: 'Bearer forged' }],
        },
        { token: 'real' },
      );
      expect(calls[0].headers.authorization).toBe('Bearer real');
    });

    it('asks for a credential, and rejects a header name that is not valid', async () => {
      const { calls, run } = setup();
      expect(
        (await failure(run({ authentication: 'httpBearerAuth' }))).message,
      ).toBe('Choose a credential for this node');
      expect(
        (
          await failure(
            run(
              { authentication: 'httpHeaderAuth' },
              { name: 'bad name', value: 'v' },
            ),
          )
        ).message,
      ).toContain('no valid header name');
      expect(calls).toHaveLength(0);
    });
  });

  describe('the answer', () => {
    it('detects JSON from the content type', async () => {
      const { run } = setup();
      expect(await run({})).toEqual({
        status: 200,
        ok: true,
        headers: { 'content-type': 'application/json' },
        body: { id: 7 },
      });
    });

    it('keeps text as text, and JSON that says it is not parseable as text', async () => {
      const text = setup(
        answer({
          headers: { 'content-type': 'text/plain' },
          body: Buffer.from('{"id":7}'),
        }),
      );
      expect((await text.run({})).body).toBe('{"id":7}');
      const broken = setup(answer({ body: Buffer.from('<html>') }));
      expect((await broken.run({})).body).toBe('<html>');
    });

    it('returns null for an empty answer', async () => {
      const { run } = setup(answer({ status: 204, body: Buffer.alloc(0) }));
      expect(await run({})).toMatchObject({
        status: 204,
        ok: true,
        body: null,
      });
    });

    it('can force JSON or text', async () => {
      const plain = setup(
        answer({
          headers: { 'content-type': 'text/plain' },
          body: Buffer.from('{"id":7}'),
        }),
      );
      expect((await plain.run({ response_format: 'json' })).body).toEqual({
        id: 7,
      });
      const json = setup();
      expect((await json.run({ response_format: 'text' })).body).toBe(
        '{"id":7}',
      );
      const html = setup(answer({ body: Buffer.from('<html>') }));
      expect(
        (await failure(html.run({ response_format: 'json' }))).message,
      ).toBe('The response is not valid JSON');
    });
  });

  describe('error statuses', () => {
    const notFound = answer({
      status: 404,
      body: Buffer.from('{"error":"no such order"}'),
    });

    it('fails with the status and what the server said', async () => {
      const { run } = setup(notFound);
      const error = await failure(run({}));
      expect(error).toBeInstanceOf(AppApiError);
      expect(error.message).toBe(
        'The server answered 404: {"error":"no such order"}',
      );
      expect((error as AppApiError).retryable).toBe(false);
    });

    it('passes the answer on when asked not to fail', async () => {
      const { run } = setup(notFound);
      expect(await run({ fail_on_error_status: false })).toMatchObject({
        status: 404,
        ok: false,
        body: { error: 'no such order' },
      });
    });

    it.each([
      ['GET', 503, true],
      ['PUT', 429, true],
      ['DELETE', 500, true],
      ['POST', 503, false],
      ['PATCH', 500, false],
      ['GET', 400, false],
    ])('%s answered %i: retry is %s', async (method, status, retryable) => {
      const { run } = setup(answer({ status, body: Buffer.from('x') }));
      const error = (await failure(run({ method }))) as AppApiError;
      expect(error.retryable).toBe(retryable);
    });

    it('shortens a long answer in the message', async () => {
      const { run } = setup(
        answer({ status: 500, body: Buffer.from('y'.repeat(500)) }),
      );
      const error = await failure(run({}));
      expect(error.message.length).toBeLessThan(260);
      expect(error.message.endsWith('…')).toBe(true);
    });
  });

  describe('network failures', () => {
    it('can be retried for a call that is safe to repeat only', async () => {
      const timeout = new HttpTransportError('The request timed out', true);
      const get = (await failure(
        setup(timeout).run({ method: 'GET' }),
      )) as AppApiError;
      expect(get).toBeInstanceOf(AppApiError);
      expect(get.retryable).toBe(true);
      const post = (await failure(
        setup(timeout).run({ method: 'POST' }),
      )) as AppApiError;
      expect(post.retryable).toBe(false);
      const refused = new HttpTransportError(
        'Could not find the server',
        false,
      );
      expect(
        ((await failure(setup(refused).run({}))) as AppApiError).retryable,
      ).toBe(false);
    });

    it('explains a blocked address and never retries it', async () => {
      const blocked = new BlockedAddressError(
        '"127.0.0.1" points to a private or internal address',
      );
      const error = (await failure(
        setup(blocked).run({ url: 'http://127.0.0.1/' }),
      )) as AppApiError;
      expect(error).toBeInstanceOf(AppApiError);
      expect(error.message).toContain('private or internal');
      expect(error.retryable).toBe(false);
    });
  });
});
