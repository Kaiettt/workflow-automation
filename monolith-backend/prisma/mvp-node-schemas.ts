// config_schema of the MVP node types. Plain data (no imports) so the seed and
// the execution tests share a single source of truth.

export const MANUAL_TRIGGER_CONFIG_SCHEMA = {
  type: 'object',
  properties: {},
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

const CONDITION_ITEM = {
  type: 'object',
  'x-propertyOrder': ['value1', 'operator', 'value2'],
  properties: {
    value1: { type: 'string', title: 'Value', 'x-allowExpression': true },
    operator: {
      type: 'string',
      default: 'contains',
      enum: [
        'equals',
        'not_equals',
        'contains',
        'not_contains',
        'starts_with',
        'ends_with',
        'regex',
        'is_empty',
        'is_not_empty',
        'gt',
        'lt',
      ],
      'x-enumLabels': {
        equals: 'equals',
        not_equals: 'does not equal',
        contains: 'contains',
        not_contains: 'does not contain',
        starts_with: 'starts with',
        ends_with: 'ends with',
        regex: 'matches regex',
        is_empty: 'is empty',
        is_not_empty: 'is not empty',
        gt: 'is greater than',
        lt: 'is less than',
      },
    },
    value2: {
      type: 'string',
      title: 'Compare to',
      'x-allowExpression': true,
      'x-hideWhen': { field: 'operator', in: ['is_empty', 'is_not_empty'] },
    },
  },
};

const COMBINE = {
  type: 'string',
  enum: ['and', 'or'],
  default: 'and',
  title: 'Combine conditions',
  'x-enumLabels': { and: 'All must match (AND)', or: 'Any can match (OR)' },
};
const IGNORE_CASE = { type: 'boolean', default: true, title: 'Ignore case' };
const IGNORE_ACCENTS = {
  type: 'boolean',
  default: true,
  title: 'Ignore accents',
  description: 'Treat "giá" and "gia" as the same word',
};

// Sends each item to the "true" or "false" output.
export const IF_CONFIG_SCHEMA = {
  type: 'object',
  required: ['conditions'],
  'x-propertyOrder': ['conditions', 'combine', 'ignore_case', 'ignore_accents'],
  'x-outputs': {
    static: [
      { key: 'true', label: 'True' },
      { key: 'false', label: 'False' },
    ],
  },
  properties: {
    conditions: {
      type: 'array',
      title: 'Conditions',
      default: [{ value1: '{{$json.text}}', operator: 'contains', value2: '' }],
      items: CONDITION_ITEM,
    },
    combine: COMBINE,
    ignore_case: IGNORE_CASE,
    ignore_accents: IGNORE_ACCENTS,
  },
};

// One output per rule (named by the rule's id) plus "fallback" for items that match none.
export const SWITCH_CONFIG_SCHEMA = {
  type: 'object',
  required: ['rules'],
  'x-propertyOrder': ['rules', 'mode', 'ignore_case', 'ignore_accents'],
  'x-outputs': { fromConfig: 'rules', labelField: 'label', fallback: true },
  properties: {
    rules: {
      type: 'array',
      title: 'Rules',
      items: {
        type: 'object',
        'x-rowId': true,
        'x-propertyOrder': ['label', 'conditions', 'combine'],
        properties: {
          label: {
            type: 'string',
            title: 'Output name',
            'x-placeholder': 'e.g. Price question',
          },
          conditions: {
            type: 'array',
            title: 'Conditions',
            default: [
              { value1: '{{$json.text}}', operator: 'contains', value2: '' },
            ],
            items: CONDITION_ITEM,
          },
          combine: COMBINE,
        },
      },
    },
    mode: {
      type: 'string',
      enum: ['first', 'all'],
      default: 'first',
      title: 'Which rules',
      'x-enumLabels': {
        first: 'First match only',
        all: 'Every matching rule',
      },
    },
    ignore_case: IGNORE_CASE,
    ignore_accents: IGNORE_ACCENTS,
  },
};

// Adds or overwrites fields on every item; a field name may be a path such as "customer.name".
export const SET_CONFIG_SCHEMA = {
  type: 'object',
  'x-propertyOrder': ['fields', 'keep_other_fields'],
  properties: {
    fields: {
      type: 'array',
      title: 'Fields',
      items: {
        type: 'object',
        'x-propertyOrder': ['name', 'value'],
        properties: {
          name: {
            type: 'string',
            title: 'Name',
            'x-placeholder': 'e.g. reply',
          },
          value: { type: 'string', title: 'Value', 'x-allowExpression': true },
        },
      },
    },
    keep_other_fields: {
      type: 'boolean',
      default: true,
      title: 'Keep the other fields',
    },
  },
};

// Reads and writes the recent messages of one conversation. "load" adds
// `history` (for the LLM node) and `history_text` to the item.
export const CHAT_MEMORY_CONFIG_SCHEMA = {
  type: 'object',
  required: ['session_key'],
  'x-propertyOrder': [
    'mode',
    'session_key',
    'window',
    'user_message',
    'assistant_message',
    'ttl_days',
  ],
  properties: {
    mode: {
      type: 'string',
      title: 'Action',
      enum: ['load', 'save', 'clear'],
      default: 'load',
      'x-enumLabels': {
        load: 'Load the conversation',
        save: 'Save a turn',
        clear: 'Forget the conversation',
      },
    },
    session_key: {
      type: 'string',
      title: 'Session key',
      'x-allowExpression': true,
      default: '{{$node["Messenger Trigger"].json.sender_id}}',
      description:
        'Who the conversation is with, e.g. the sender_id of the Messenger Trigger',
    },
    window: {
      type: 'integer',
      title: 'Turns to load',
      minimum: 1,
      maximum: 25,
      default: 10,
      'x-hideWhen': { field: 'mode', in: ['save', 'clear'] },
    },
    user_message: {
      type: 'string',
      title: 'Customer message',
      'x-allowExpression': true,
      // No default: a default expression would also be evaluated in "load" mode.
      'x-placeholder': '{{$node["Messenger Trigger"].json.text}}',
      'x-hideWhen': { field: 'mode', in: ['load', 'clear'] },
    },
    assistant_message: {
      type: 'string',
      title: 'Bot reply',
      'x-allowExpression': true,
      'x-placeholder': '{{$node["LLM"].json.text}}',
      'x-hideWhen': { field: 'mode', in: ['load', 'clear'] },
    },
    ttl_days: {
      type: 'integer',
      title: 'Forget after (days)',
      minimum: 1,
      maximum: 90,
      default: 7,
      'x-hideWhen': { field: 'mode', in: ['load', 'clear'] },
    },
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
    'history',
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
    history: {
      type: 'string',
      title: 'Conversation history',
      'x-allowExpression': true,
      description:
        'Optional. Earlier messages, e.g. {{$json.history}} from a Chat Memory node',
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
