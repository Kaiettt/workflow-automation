export type Provider = 'antigravity' | 'codex' | 'claude' | 'cursor';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type EventKind = 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error';
export interface LogEvent {
  id: string;
  kind: EventKind;
  timestamp: string;
  content: string;
  data?: Json;
  callId?: string;
  stepIndex?: number;
  order?: number;
  phase?: string;
}
export interface Source {
  provider: Provider;
  path: string;
  sessionId?: string;
  workspace?: string;
}
export interface Session {
  version: 1;
  provider: Provider;
  sessionId: string;
  workspace: string;
  model: string;
  events: LogEvent[];
  sources: string[];
  warnings: string[];
  modifiedAt: string;
}
export interface CollectOptions {
  workspace: string;
  home: string;
  sources?: Source[];
}