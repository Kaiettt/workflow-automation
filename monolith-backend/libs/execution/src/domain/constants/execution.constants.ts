export enum ExecutionStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export const NodeKeys = {
  GMAIL_SEND: 'integration.gmail.send',
  GOOGLE_SHEET_READ_ROWS: 'integration.google_sheet.readRows',
  TRIGGER_MANUAL: 'trigger.manual',
  LOGIC_FILTER: 'logic.filter',
} as const;

export const ConnectorKeys = {
  GOOGLE: 'google',
} as const;
