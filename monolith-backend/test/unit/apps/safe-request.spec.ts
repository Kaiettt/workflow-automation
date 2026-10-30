import http from 'node:http';
import { AddressInfo } from 'node:net';
import {
  BlockedAddressError,
  HttpTransportError,
  isBlockedAddress,
  safeRequest,
  SafeRequest,
} from '@app/apps/http/safe-request';

describe('isBlockedAddress', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    '64:ff9b::7f00:1',
    'not-an-address',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.0.1',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ])('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe('safeRequest', () => {
  const servers: http.Server[] = [];
  const seen: Array<{
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
  }> = [];

  async function serve(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<string> {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        seen.push({
          method: req.method ?? '',
          url: req.url ?? '',
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        });
        handler(req, res);
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const request = (url: string, overrides: Partial<SafeRequest> = {}) =>
    safeRequest({
      method: 'GET',
      url,
      headers: {},
      timeoutMs: 5000,
      maxBytes: 1024 * 1024,
      maxRedirects: 5,
      allowPrivate: true,
      ...overrides,
    });

  beforeEach(() => {
    seen.length = 0;
  });
  afterAll(async () => {
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });

  it('returns status, headers and body', async () => {
    const base = await serve((_req, res) => {
      res.writeHead(201, {
        'content-type': 'application/json',
        'set-cookie': 'a=b',
      });
      res.end('{"ok":true}');
    });
    const response = await request(`${base}/path?x=1`);

    expect(response.status).toBe(201);
    expect(response.body.toString()).toBe('{"ok":true}');
    expect(response.headers['content-type']).toBe('application/json');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(seen[0]).toMatchObject({ method: 'GET', url: '/path?x=1' });
  });

  it('sends the method, headers and body, and never asks for compression', async () => {
    const base = await serve((_req, res) => res.end('ok'));
    await request(`${base}/`, {
      method: 'POST',
      headers: { 'x-test': 'yes', 'content-type': 'application/json' },
      body: Buffer.from('{"a":1}'),
    });

    expect(seen[0].method).toBe('POST');
    expect(seen[0].headers['x-test']).toBe('yes');
    expect(seen[0].headers['accept-encoding']).toBe('identity');
    expect(seen[0].headers['content-length']).toBe('7');
    expect(seen[0].body).toBe('{"a":1}');
  });

  it('follows redirects and turns a POST into a GET on 302', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { location: '/end' });
        res.end();
      } else {
        res.end('arrived');
      }
    });
    const response = await request(`${base}/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{}'),
    });

    expect(response.body.toString()).toBe('arrived');
    expect(response.url).toBe(`${base}/end`);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST /start',
      'GET /end',
    ]);
    expect(seen[1].headers['content-type']).toBeUndefined();
    expect(seen[1].body).toBe('');
  });

  it('keeps the method and body on a 307', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/start') {
        res.writeHead(307, { location: '/end' });
        res.end();
      } else {
        res.end('arrived');
      }
    });
    await request(`${base}/start`, {
      method: 'POST',
      body: Buffer.from('keep'),
    });

    expect(seen[1]).toMatchObject({ method: 'POST', body: 'keep' });
  });

  it('does not pass the credentials on to another host', async () => {
    const other = await serve((_req, res) => res.end('other'));
    const base = await serve((_req, res) => {
      res.writeHead(302, { location: `${other}/` });
      res.end();
    });
    await request(`${base}/`, {
      headers: { authorization: 'Bearer secret', cookie: 'a=b', 'x-keep': '1' },
    });

    expect(seen[0].headers.authorization).toBe('Bearer secret');
    expect(seen[1].headers.authorization).toBeUndefined();
    expect(seen[1].headers.cookie).toBeUndefined();
    expect(seen[1].headers['x-keep']).toBe('1');
  });

  it('stops after too many redirects', async () => {
    const base = await serve((_req, res) => {
      res.writeHead(302, { location: '/again' });
      res.end();
    });
    await expect(request(`${base}/`, { maxRedirects: 2 })).rejects.toThrow(
      'More than 2 redirects',
    );
    expect(seen).toHaveLength(3);
  });

  it('refuses a response larger than the limit', async () => {
    const base = await serve((_req, res) => res.end('x'.repeat(5000)));
    await expect(
      request(`${base}/`, { maxBytes: 1000 }),
    ).rejects.toBeInstanceOf(HttpTransportError);
  });

  it('times out, and says it can be tried again', async () => {
    const base = await serve(() => undefined);
    const error = await request(`${base}/`, { timeoutMs: 150 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(HttpTransportError);
    expect((error as HttpTransportError).message).toContain('timed out');
    expect((error as HttpTransportError).retryable).toBe(true);
  });

  it('reports a refused connection', async () => {
    const base = await serve((_req, res) => res.end('x'));
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    servers.length = 0;
    const error = await request(`${base}/`).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpTransportError);
    expect((error as HttpTransportError).message).toContain('ECONNREFUSED');
  });

  it.each([
    ['ftp://example.com/file', 'Only http:// and https://'],
    ['file:///etc/passwd', 'Only http:// and https://'],
    ['http://user:pass@example.com/', 'credential, not in the URL'],
    ['not a url', 'not a valid URL'],
  ])('refuses %s', async (url, message) => {
    await expect(request(url)).rejects.toThrow(message);
  });

  describe('when private addresses are not allowed', () => {
    const strict = (url: string) => request(url, { allowPrivate: false });

    it.each([
      'http://127.0.0.1:1/',
      'http://localhost:1/',
      'http://[::1]:1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/',
      'http://192.168.0.1/',
      'http://2130706433/',
      'http://0x7f.1/',
      'http://[::ffff:127.0.0.1]/',
    ])('blocks %s before connecting', async (url) => {
      await expect(strict(url)).rejects.toBeInstanceOf(BlockedAddressError);
    });

    it('does not reach a local server', async () => {
      const base = await serve((_req, res) => res.end('secret'));
      await expect(strict(`${base}/`)).rejects.toBeInstanceOf(
        BlockedAddressError,
      );
      expect(seen).toHaveLength(0);
    });
  });
});
