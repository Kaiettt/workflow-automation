import {
  ActionNode,
  AppApiError,
  CredentialType,
  IntegrationPackage,
  ItemJson,
  NodeProperty,
} from '../core/package';
import {
  BlockedAddressError,
  HttpTransportError,
  safeRequest,
  SafeRequest,
  SafeResponse,
} from './safe-request';

export const HTTP_AUTH_HEADER = 'httpHeaderAuth';
export const HTTP_AUTH_BEARER = 'httpBearerAuth';
export const HTTP_AUTH_BASIC = 'httpBasicAuth';

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 5;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
// Repeating these cannot do harm, so a failed call may be tried again; a
// POST that failed may have been done, so it is not.
const SAFE_TO_RETRY = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);
// A header name is a token (RFC 9110).
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const credentials: CredentialType[] = [
  {
    key: HTTP_AUTH_HEADER,
    displayName: 'HTTP header (API key)',
    fields: [
      {
        name: 'name',
        displayName: 'Header name',
        description: 'e.g. X-API-Key',
      },
      { name: 'value', displayName: 'Header value', secret: true },
    ],
  },
  {
    key: HTTP_AUTH_BEARER,
    displayName: 'HTTP bearer token',
    fields: [{ name: 'token', displayName: 'Token', secret: true }],
  },
  {
    key: HTTP_AUTH_BASIC,
    displayName: 'HTTP basic auth',
    fields: [
      { name: 'user', displayName: 'User name' },
      { name: 'password', displayName: 'Password', secret: true },
    ],
  },
];

const nameValue = (what: string): NodeProperty[] => [
  {
    name: 'name',
    displayName: 'Name',
    type: 'string',
    expression: true,
    placeholder: what,
  },
  { name: 'value', displayName: 'Value', type: 'string', expression: true },
];

const bodyTypes = ['none', 'json', 'form', 'raw'] as const;
type BodyType = (typeof bodyTypes)[number];
const hiddenUnless = (...shown: BodyType[]) => ({
  field: 'body_type',
  in: bodyTypes.filter((type) => !shown.includes(type)),
});

export interface HttpPackageOptions {
  // Reads HTTP_REQUEST_ALLOW_PRIVATE by default.
  allowPrivate?: () => boolean;
  // Replaceable in tests.
  request?: (request: SafeRequest) => Promise<SafeResponse>;
}

function text(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';
}

function rows(value: unknown): Array<[string, string]> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): Array<[string, string]> => {
    if (typeof row !== 'object' || row === null) return [];
    const { name, value: cell } = row as Record<string, unknown>;
    const key = text(name).trim();
    return key ? [[key, text(cell)]] : [];
  });
}

function parseJson(raw: string, what: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${what} is not valid JSON`);
  }
}

// The request body for the chosen body type.
function buildBody(parameters: Record<string, unknown>): {
  body?: Buffer;
  contentType?: string;
} {
  const type = (text(parameters.body_type) || 'none') as BodyType;
  if (!bodyTypes.includes(type)) {
    throw new Error(`"${type}" is not a body type`);
  }
  if (type === 'none') return {};
  if (type === 'form') {
    const form = new URLSearchParams();
    for (const [name, value] of rows(parameters.form)) form.append(name, value);
    return {
      body: Buffer.from(form.toString()),
      contentType: 'application/x-www-form-urlencoded',
    };
  }
  const raw = parameters.body;
  if (type === 'raw') {
    return {
      body: Buffer.from(
        typeof raw === 'string' ? raw : JSON.stringify(raw ?? ''),
      ),
      contentType: 'text/plain; charset=utf-8',
    };
  }
  // A single {{expression}} arrives as the value itself (object, list…).
  const json =
    typeof raw === 'string'
      ? raw.trim() === ''
        ? undefined
        : parseJson(raw, 'The body')
      : raw;
  return {
    body: json === undefined ? undefined : Buffer.from(JSON.stringify(json)),
    contentType: 'application/json',
  };
}

function authHeader(
  authentication: string,
  secret: Record<string, unknown> | null,
): Record<string, string> {
  if (authentication === 'none' || authentication === '') return {};
  if (!secret) throw new Error('Choose a credential for this node');
  if (authentication === HTTP_AUTH_HEADER) {
    const name = text(secret.name).trim();
    if (!HEADER_NAME.test(name)) {
      throw new Error('The credential has no valid header name');
    }
    return { [name]: text(secret.value) };
  }
  if (authentication === HTTP_AUTH_BEARER) {
    return { authorization: `Bearer ${text(secret.token)}` };
  }
  if (authentication === HTTP_AUTH_BASIC) {
    const pair = `${text(secret.user)}:${text(secret.password)}`;
    return { authorization: `Basic ${Buffer.from(pair).toString('base64')}` };
  }
  throw new Error(`"${authentication}" is not an authentication type`);
}

function parseResponse(response: SafeResponse, format: string): unknown {
  const raw = response.body.toString('utf-8');
  const isJson = /json/i.test(response.headers['content-type'] ?? '');
  if (format === 'text') return raw;
  if (format === 'json') {
    if (raw.trim() === '') return null;
    return parseJson(raw, 'The response');
  }
  if (!isJson || raw.trim() === '') return raw === '' ? null : raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function sentenceOf(body: unknown): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}

export function createHttpPackage(
  options: HttpPackageOptions = {},
): IntegrationPackage {
  const allowPrivate =
    options.allowPrivate ??
    (() => process.env['HTTP_REQUEST_ALLOW_PRIVATE'] === 'true');
  const send = options.request ?? safeRequest;

  const node: ActionNode = {
    kind: 'action',
    key: 'http.request',
    displayName: 'HTTP Request',
    description: 'Call any web API and use its answer in the next nodes',
    icon: 'globe',
    color: '#475569',
    credentialTypeFrom: {
      field: 'authentication',
      types: [HTTP_AUTH_HEADER, HTTP_AUTH_BEARER, HTTP_AUTH_BASIC],
    },
    properties: [
      {
        name: 'method',
        displayName: 'Method',
        type: 'options',
        default: 'GET',
        options: METHODS.map((method) => ({ value: method, label: method })),
      },
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        required: true,
        expression: true,
        placeholder: 'https://api.example.com/orders/{{$json.order_id}}',
      },
      {
        name: 'authentication',
        displayName: 'Authentication',
        type: 'options',
        default: 'none',
        options: [
          { value: 'none', label: 'None' },
          { value: HTTP_AUTH_HEADER, label: 'Header (API key)' },
          { value: HTTP_AUTH_BEARER, label: 'Bearer token' },
          { value: HTTP_AUTH_BASIC, label: 'Basic auth' },
        ],
      },
      {
        name: 'query',
        displayName: 'Query parameters',
        type: 'collection',
        fields: nameValue('e.g. page'),
      },
      {
        name: 'headers',
        displayName: 'Headers',
        type: 'collection',
        fields: nameValue('e.g. Accept'),
      },
      {
        name: 'body_type',
        displayName: 'Body',
        type: 'options',
        default: 'none',
        options: [
          { value: 'none', label: 'No body' },
          { value: 'json', label: 'JSON' },
          { value: 'form', label: 'Form (urlencoded)' },
          { value: 'raw', label: 'Text' },
        ],
      },
      {
        name: 'body',
        displayName: 'Body content',
        type: 'string',
        expression: true,
        multiline: true,
        placeholder: '{"customer": "{{$json.name}}"}',
        hideWhen: hiddenUnless('json', 'raw'),
      },
      {
        name: 'form',
        displayName: 'Form fields',
        type: 'collection',
        fields: nameValue('e.g. email'),
        hideWhen: hiddenUnless('form'),
      },
      {
        name: 'timeout_ms',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: DEFAULT_TIMEOUT_MS,
        description: `Up to ${MAX_TIMEOUT_MS}`,
      },
      {
        name: 'response_format',
        displayName: 'Response',
        type: 'options',
        default: 'auto',
        options: [
          { value: 'auto', label: 'Detect (JSON when it says so)' },
          { value: 'json', label: 'Always JSON' },
          { value: 'text', label: 'Always text' },
        ],
      },
      {
        name: 'fail_on_error_status',
        displayName: 'Fail on error status',
        type: 'boolean',
        default: true,
        description:
          'Off: a 4xx / 5xx answer is passed on (see status and ok) instead of stopping the workflow',
      },
    ],

    async execute({ parameters, credential }): Promise<ItemJson> {
      const method = (text(parameters.method) || 'GET').toUpperCase();
      if (!METHODS.includes(method)) {
        throw new Error(`"${method}" is not a supported method`);
      }
      const rawUrl = text(parameters.url).trim();
      if (!rawUrl) throw new Error('URL is required');
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        throw new Error(`"${rawUrl}" is not a valid URL (start with https://)`);
      }
      for (const [name, value] of rows(parameters.query)) {
        url.searchParams.append(name, value);
      }

      const headers: Record<string, string> = {};
      for (const [name, value] of rows(parameters.headers)) {
        if (!HEADER_NAME.test(name)) {
          throw new Error(`"${name}" is not a valid header name`);
        }
        headers[name.toLowerCase()] = value;
      }
      const { body, contentType } =
        method === 'GET' || method === 'HEAD' ? {} : buildBody(parameters);
      if (contentType && !('content-type' in headers)) {
        headers['content-type'] = contentType;
      }
      // The credential comes last, so a header typed by hand cannot replace it.
      for (const [name, value] of Object.entries(
        authHeader(text(parameters.authentication), credential),
      )) {
        headers[name.toLowerCase()] = value;
      }

      const timeout = Number(parameters.timeout_ms ?? DEFAULT_TIMEOUT_MS);
      const timeoutMs =
        Number.isFinite(timeout) && timeout > 0
          ? Math.min(timeout, MAX_TIMEOUT_MS)
          : DEFAULT_TIMEOUT_MS;
      const idempotent = SAFE_TO_RETRY.has(method);

      let response: SafeResponse;
      try {
        response = await send({
          method,
          url: url.toString(),
          headers,
          body,
          timeoutMs,
          maxBytes: MAX_RESPONSE_BYTES,
          maxRedirects: MAX_REDIRECTS,
          allowPrivate: allowPrivate(),
        });
      } catch (error) {
        if (error instanceof BlockedAddressError) {
          throw new AppApiError(error.message, false);
        }
        if (error instanceof HttpTransportError) {
          throw new AppApiError(error.message, error.retryable && idempotent);
        }
        throw error;
      }

      const ok = response.status >= 200 && response.status < 300;
      const data = parseResponse(
        response,
        text(parameters.response_format) || 'auto',
      );
      if (!ok && parameters.fail_on_error_status !== false) {
        throw new AppApiError(
          `The server answered ${response.status}${sentenceOf(data) ? `: ${sentenceOf(data)}` : ''}`,
          idempotent && (response.status === 429 || response.status >= 500),
        );
      }
      return {
        status: response.status,
        ok,
        headers: response.headers,
        body: data,
      };
    },
  };

  return {
    key: 'http',
    displayName: 'HTTP',
    credentials,
    nodes: [node],
  };
}
