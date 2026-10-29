// The contract every integration package implements. The webhook ingress,
// workflow activation, catalog sync, OAuth2 and the designer only talk to these
// types, so adding an app never touches them.

export type ItemJson = Record<string, unknown>;

export interface FieldOption {
  value: string;
  label: string;
}

export interface LoadOptionsContext {
  // Decrypted credential of the node, null when the node has none.
  credential: Record<string, unknown> | null;
}

// One field of a node's form.
export interface NodeProperty {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'options';
  required?: boolean;
  default?: unknown;
  description?: string;
  placeholder?: string;
  // Takes {{ }} expressions, resolved per item before the node runs.
  expression?: boolean;
  multiline?: boolean;
  // Fixed choices of an `options` field.
  options?: FieldOption[];
  // Choices read at design time (e.g. the Pages of a credential).
  loadOptions?(context: LoadOptionsContext): Promise<FieldOption[]>;
}

// One input of a credential form.
export interface CredentialField {
  name: string;
  displayName: string;
  required?: boolean;
  // Typed hidden, never shown again.
  secret?: boolean;
  description?: string;
}

export interface OAuth2Spec {
  authorizationUrl: string;
  scopes: string[];
  scopeSeparator?: string;
  // The authorization code → values merged into the credential (tokens, …).
  // `values` are the fields the user typed (client_id, client_secret).
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    values: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
}

export interface CredentialType {
  key: string; // connectors.key
  displayName: string;
  fields: CredentialField[];
  oauth2?: OAuth2Spec;
}

export interface WebhookRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: unknown;
  rawBody?: Buffer; // exact bytes, for signature checks
}

export interface TriggerEvent {
  // Same id on the same endpoint within 24h is processed once.
  id?: string;
  json: ItemJson;
}

export interface WebhookResult {
  status: number;
  // Default: { success, data: { started, ignored } }.
  body?: unknown;
  contentType?: string;
  events: TriggerEvent[];
}

export interface WebhookLifecycleContext {
  // Public URL of the endpoint: {PUBLIC_BASE_URL}/api/webhooks/<id>.
  url: string;
  credential: Record<string, unknown> | null;
  // Stored with the endpoint; changes made here are saved after the call.
  data: Record<string, unknown>;
  // Parameters of every listener on the endpoint (all workflows).
  listeners: Array<Record<string, unknown>>;
}

export interface WebhookRequestContext {
  request: WebhookRequest;
  credential: Record<string, unknown> | null;
  data: Record<string, unknown>;
}

export interface WebhookSpec {
  // 'node': one URL per trigger node. 'credential': one URL per credential
  // (e.g. a Meta App has a single callback URL).
  scope: 'node' | 'credential';
  // Data of a new endpoint (e.g. a verify token the app checks against).
  initialData?(): Record<string, unknown>;
  // Registration with the outside app, called on activation / test listen.
  checkExists?(context: WebhookLifecycleContext): Promise<boolean>;
  create?(context: WebhookLifecycleContext): Promise<void>;
  delete?(context: WebhookLifecycleContext): Promise<void>;
  // Handshake, verification and parsing of one incoming request.
  handle(
    context: WebhookRequestContext,
  ): WebhookResult | Promise<WebhookResult>;
  // Whether a listener with these parameters takes the event (default: yes).
  accepts?(event: TriggerEvent, parameters: Record<string, unknown>): boolean;
}

interface NodeBase {
  key: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  // Adds a credential_id field limited to this credential type.
  credentialType?: string;
  properties: NodeProperty[];
}

export interface TriggerNode extends NodeBase {
  kind: 'trigger';
  webhook: WebhookSpec;
}

export interface ActionNode extends NodeBase {
  kind: 'action';
  // Runs once per input item with the item's resolved parameters.
  execute(context: {
    parameters: Record<string, unknown>;
    credential: Record<string, unknown> | null;
    item: { json: ItemJson };
  }): Promise<ItemJson | ItemJson[] | null>;
}

export type PackageNode = TriggerNode | ActionNode;

export interface IntegrationPackage {
  key: string;
  displayName: string;
  credentials: CredentialType[];
  nodes: PackageNode[];
}

// An app API refused or failed a call; `retryable` for rate limits and outages.
export class AppApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
