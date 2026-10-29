// config_schema of the MVP node types. Plain data (no imports) so the seed and
// the execution tests share a single source of truth.

export const MANUAL_TRIGGER_CONFIG_SCHEMA = {
  type: 'object',
  properties: {},
};

// No settings: the URL is generated on publish and shown by the designer
// because of x-display.
export const WEBHOOK_TRIGGER_CONFIG_SCHEMA = {
  type: 'object',
  properties: {},
  'x-display': 'webhookUrl',
};

export const GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA = {
  type: 'object',
  required: ['credential_id', 'spreadsheet_id', 'sheet_name'],
  'x-propertyOrder': ['credential_id', 'spreadsheet_id', 'sheet_name'],
  properties: {
    credential_id: { type: 'string', 'x-connectorKey': 'google' },
    spreadsheet_id: { type: 'string' },
    sheet_name: { type: 'string' },
  },
};

// `field` is a path inside the item (e.g. "status", "data.label"), not an expression.
export const FILTER_CONFIG_SCHEMA = {
  type: 'object',
  required: ['field', 'operator', 'value'],
  'x-propertyOrder': ['field', 'operator', 'value'],
  properties: {
    field: { type: 'string' },
    operator: { type: 'string', enum: ['equals', 'not_equals', 'contains'] },
    value: { type: 'string', 'x-allowExpression': true },
  },
};

// `to` defaults to the item's email so workflows published before the field existed keep working.
export const GMAIL_SEND_CONFIG_SCHEMA = {
  type: 'object',
  required: ['credential_id', 'to', 'subject', 'body'],
  'x-propertyOrder': ['credential_id', 'to', 'subject', 'body'],
  properties: {
    credential_id: { type: 'string', 'x-connectorKey': 'google' },
    to: {
      type: 'string',
      'x-allowExpression': true,
      default: '{{$json.email}}',
    },
    subject: { type: 'string', 'x-allowExpression': true },
    body: { type: 'string', 'x-allowExpression': true },
  },
};

export const AGGREGATE_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    field: { type: 'string', default: 'items' },
  },
};

// One node for every LLM vendor: `provider` picks the vendor, and the credential
// must belong to it (x-connectorKeyFrom). prompt / system_prompt take expressions.
export const LLM_GENERATE_CONFIG_SCHEMA = {
  type: 'object',
  required: ['provider', 'credential_id', 'model', 'prompt'],
  'x-propertyOrder': [
    'provider',
    'credential_id',
    'model',
    'system_prompt',
    'prompt',
    'output_format',
    'max_tokens',
    'temperature',
    'max_items',
  ],
  properties: {
    provider: {
      type: 'string',
      title: 'Provider',
      enum: ['anthropic', 'openai', 'gemini'],
    },
    credential_id: {
      type: 'string',
      title: 'Credential',
      'x-refType': 'credential',
      'x-connectorKeyFrom': 'provider',
    },
    model: {
      type: 'string',
      title: 'Model',
      // Grey hint in the box; models change often, so it is free text, not a list.
      'x-placeholderByField': {
        field: 'provider',
        values: {
          anthropic: 'e.g. claude-opus-5-5',
          openai: 'e.g. gpt-4o-mini',
          gemini: 'e.g. gemini-2.0-flash',
        },
      },
    },
    system_prompt: {
      type: 'string',
      title: 'System prompt',
      'x-allowExpression': true,
      'x-multiline': true,
    },
    prompt: {
      type: 'string',
      title: 'Prompt',
      'x-allowExpression': true,
      'x-multiline': true,
    },
    output_format: {
      type: 'string',
      title: 'Output format',
      enum: ['text', 'json'],
      default: 'text',
    },
    max_tokens: {
      type: 'integer',
      title: 'Max tokens',
      minimum: 1,
      default: 1024,
    },
    temperature: { type: 'number', title: 'Temperature', minimum: 0 },
    max_items: {
      type: 'integer',
      title: 'Max items',
      minimum: 1,
      default: 50,
    },
  },
};

// API-key connectors share one shape: a single secret field.
export const API_KEY_CONNECTOR_CONFIG_SCHEMA = {
  type: 'object',
  required: ['api_key'],
  properties: {
    api_key: {
      type: 'string',
      title: 'API Key',
      'x-secret': true,
      'x-testable': true,
    },
  },
};

// Facebook Page connection, typed in by the user (copied from the Meta app
// dashboard). page_id routes incoming messages to the workflow; it is not a secret.
export const MESSENGER_CONNECTOR_CONFIG_SCHEMA = {
  type: 'object',
  required: ['page_id', 'page_access_token'],
  'x-propertyOrder': ['page_id', 'page_access_token'],
  properties: {
    page_id: { type: 'string', title: 'Page ID' },
    page_access_token: {
      type: 'string',
      title: 'Page Access Token',
      'x-secret': true,
    },
  },
};

// x-credentialInput: the credential is typed into a form (not an OAuth pop-up).
const MESSENGER_CREDENTIAL_FIELD = {
  type: 'string',
  title: 'Facebook Page',
  'x-refType': 'credential',
  'x-connectorKey': 'messenger',
  'x-credentialInput': 'form',
};

// Starts the workflow for every text message a customer sends to the Page.
export const MESSENGER_TRIGGER_CONFIG_SCHEMA = {
  type: 'object',
  required: ['credential_id'],
  properties: { credential_id: MESSENGER_CREDENTIAL_FIELD },
};

// After another node (e.g. LLM) $json is that node's output, so the reply
// usually needs {{$node["<trigger name>"].json.sender_id}} instead of the default.
export const MESSENGER_SEND_CONFIG_SCHEMA = {
  type: 'object',
  required: ['credential_id', 'recipient_id', 'text'],
  'x-propertyOrder': ['credential_id', 'recipient_id', 'text'],
  properties: {
    credential_id: MESSENGER_CREDENTIAL_FIELD,
    recipient_id: {
      type: 'string',
      title: 'Recipient ID',
      description:
        'Who gets the reply. {{$json.sender_id}} works right after the trigger; after another node (e.g. LLM) use {{$node["Messenger Trigger"].json.sender_id}}.',
      'x-allowExpression': true,
      default: '{{$json.sender_id}}',
    },
    text: {
      type: 'string',
      title: 'Text',
      'x-allowExpression': true,
      'x-multiline': true,
    },
  },
};
