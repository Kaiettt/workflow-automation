export enum ExecutionStatus {
  // Waiting in the queue (webhook); no node has run yet.
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

const TERMINAL_EXECUTION_STATUSES = new Set<string>([
  ExecutionStatus.SUCCESS,
  ExecutionStatus.FAILED,
  'CANCELLED',
]);

export function isTerminalExecutionState(
  event: string,
  status: unknown,
): boolean {
  return (
    (typeof status === 'string' && TERMINAL_EXECUTION_STATUSES.has(status)) ||
    event === 'execution.completed' ||
    event === 'execution.failed' ||
    event === 'execution.cancelled'
  );
}

export enum TriggerType {
  MANUAL = 'MANUAL',
  WEBHOOK = 'WEBHOOK',
  SCHEDULE = 'SCHEDULE',
}

export const NodeKeys = {
  GMAIL_SEND: 'integration.gmail.send',
  GOOGLE_SHEET_READ_ROWS: 'integration.google_sheet.readRows',
  TRIGGER_MANUAL: 'trigger.manual',
  LOGIC_FILTER: 'logic.filter',
  LOGIC_IF: 'logic.if',
  LOGIC_SWITCH: 'logic.switch',
  DATA_SET: 'data.set',
  MEMORY_CHAT: 'memory.chat',
  DATA_AGGREGATE: 'data.aggregate',
  AI_LLM_GENERATE: 'ai.llm.generate',
} as const;

export const ConnectorKeys = {
  GOOGLE: 'google',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GEMINI: 'gemini',
} as const;

// Action nodes of integration packages: retries of temporary app errors.
export const PackageActionLimits = {
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
