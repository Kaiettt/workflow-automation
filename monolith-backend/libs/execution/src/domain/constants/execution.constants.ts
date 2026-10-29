export enum ExecutionStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum TriggerType {
  MANUAL = 'MANUAL',
  WEBHOOK = 'WEBHOOK',
}

export const NodeKeys = {
  GMAIL_SEND: 'integration.gmail.send',
  GOOGLE_SHEET_READ_ROWS: 'integration.google_sheet.readRows',
  TRIGGER_MANUAL: 'trigger.manual',
  TRIGGER_WEBHOOK: 'trigger.webhook',
  TRIGGER_MESSENGER_MESSAGE: 'trigger.messenger.message',
  MESSENGER_SEND: 'integration.messenger.send',
  LOGIC_FILTER: 'logic.filter',
  DATA_AGGREGATE: 'data.aggregate',
  AI_LLM_GENERATE: 'ai.llm.generate',
} as const;

export const ConnectorKeys = {
  GOOGLE: 'google',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  MESSENGER: 'messenger',
} as const;

export const MessengerLimits = {
  // Messenger rejects longer text messages.
  MAX_TEXT_LENGTH: 2000,
  REQUEST_TIMEOUT_MS: 15_000,
  MAX_RETRIES: 2,
} as const;

export const LlmLimits = {
  // Ceiling for a node's max_items when the LLM_MAX_ITEMS env var is not set.
  DEFAULT_MAX_ITEMS_CEILING: 100,
  DEFAULT_MAX_ITEMS: 50,
  DEFAULT_MAX_TOKENS: 1024,
  REQUEST_TIMEOUT_MS: 60_000,
  MAX_RETRIES: 2,
} as const;
