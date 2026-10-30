import { promises as dns } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, LookupFunction } from 'node:net';

// Addresses a workflow must not reach: this machine, private networks, link
// local (cloud metadata at 169.254.169.254), multicast and reserved ranges.
const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  // NAT64 embeds an IPv4 address that could be a private one.
  ['64:ff9b::', 96],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

// An IPv4 address written inside an IPv6 one (::ffff:127.0.0.1 or ::ffff:7f00:1).
function embeddedIPv4(address: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (!hex) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 4) return blocked.check(address, 'ipv4');
  const embedded = embeddedIPv4(address);
  return embedded
    ? blocked.check(embedded, 'ipv4')
    : blocked.check(address, 'ipv6');
}

export class BlockedAddressError extends Error {}

// A network failure; `retryable` for timeouts and dropped connections.
export class HttpTransportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface SafeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Buffer;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  // Lets the request reach private addresses (development only).
  allowPrivate: boolean;
}

export interface SafeResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  url: string;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
// Sent to the first host only: a redirect to another host must not receive them.
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
]);

// The address to connect to for `hostname`: every address it resolves to is
// checked and the connection is made to that exact one, so the name cannot
// resolve somewhere else between the check and the connection.
async function resolveAllowed(
  hostname: string,
  allowPrivate: boolean,
): Promise<{ address: string; family: 4 | 6 }> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  const family = isIP(literal);
  const addresses =
    family === 0
      ? await dns
          .lookup(literal, { all: true, verbatim: true })
          .catch((error: NodeJS.ErrnoException) => {
            throw new HttpTransportError(
              `Could not find the server "${literal}" (${error.code ?? 'DNS error'})`,
              error.code === 'EAI_AGAIN',
            );
          })
      : [{ address: literal, family }];
  if (addresses.length === 0) {
    throw new HttpTransportError(
      `Could not find the server "${literal}"`,
      false,
    );
  }
  if (!allowPrivate && addresses.some((a) => isBlockedAddress(a.address))) {
    throw new BlockedAddressError(
      `"${literal}" points to a private or internal address, which workflows cannot call`,
    );
  }
  return {
    address: addresses[0].address,
    family: addresses[0].family === 6 ? 6 : 4,
  };
}

function pinned(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => {
    if ((options as { all?: boolean }).all) {
      (callback as unknown as (e: null, a: unknown[]) => void)(null, [
        { address, family },
      ]);
    } else {
      callback(null, address, family);
    }
  };
}

function once(
  url: URL,
  request: SafeRequest,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined,
  target: { address: string; family: 4 | 6 },
  deadline: number,
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:';
    const transport = secure ? https : http;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new HttpTransportError('The request timed out', true));
      return;
    }

    const req = transport.request(
      {
        method,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          ...headers,
          host: url.host,
          // Responses are read as they are, never decompressed.
          'accept-encoding': 'identity',
          ...(body ? { 'content-length': String(body.length) } : {}),
        },
        lookup: pinned(target.address, target.family),
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let failure: Error | null = null;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > request.maxBytes) {
            failure = new HttpTransportError(
              `The response is larger than ${Math.floor(request.maxBytes / 1024 / 1024)} MB`,
              false,
            );
            req.destroy();
            response.destroy();
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (failure) return;
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on('error', reject);
        // The connection ended before the whole answer arrived.
        response.on('close', () => {
          if (failure) reject(failure);
          else if (!response.complete) {
            reject(
              new HttpTransportError(
                'The connection closed before the answer was complete',
                true,
              ),
            );
          }
        });
      },
    );
    const timer = setTimeout(
      () => req.destroy(new HttpTransportError('The request timed out', true)),
      remaining,
    );
    req.on('close', () => clearTimeout(timer));
    req.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        error instanceof HttpTransportError ||
          error instanceof BlockedAddressError
          ? error
          : new HttpTransportError(
              `The request failed (${error.code ?? error.message})`,
              ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(
                error.code ?? '',
              ),
            ),
      );
    });
    req.end(body);
  });
}

function flatten(headers: http.IncomingHttpHeaders): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || name === 'set-cookie') continue;
    flat[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  return flat;
}

// One HTTP call. Redirects are followed here (not by the HTTP library), and
// every hop is checked before it is connected to.
export async function safeRequest(request: SafeRequest): Promise<SafeResponse> {
  const deadline = Date.now() + request.timeoutMs;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    throw new HttpTransportError(`"${request.url}" is not a valid URL`, false);
  }
  let method = request.method;
  let body = request.body;
  let headers = { ...request.headers };
  const firstHost = url.host;

  for (let hop = 0; ; hop += 1) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new HttpTransportError(
        'Only http:// and https:// links can be called',
        false,
      );
    }
    if (url.username || url.password) {
      throw new HttpTransportError(
        'Put the user name and password in a credential, not in the URL',
        false,
      );
    }
    const target = await resolveAllowed(url.hostname, request.allowPrivate);
    const response = await once(
      url,
      request,
      method,
      headers,
      body,
      target,
      deadline,
    );

    const location = response.headers.location;
    if (!REDIRECTS.has(response.status) || !location) {
      return {
        status: response.status,
        headers: flatten(response.headers),
        body: response.body,
        url: url.toString(),
      };
    }
    if (hop >= request.maxRedirects) {
      throw new HttpTransportError(
        `More than ${request.maxRedirects} redirects`,
        false,
      );
    }
    url = new URL(location, url);
    // 303, and 301/302 after a POST, continue as a GET without the body.
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        method === 'POST')
    ) {
      method = method === 'HEAD' ? 'HEAD' : 'GET';
      body = undefined;
      headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => !/^content-/i.test(name)),
      );
    }
    if (url.host !== firstHost) {
      headers = Object.fromEntries(
        Object.entries(headers).filter(
          ([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()),
        ),
      );
    }
  }
}
