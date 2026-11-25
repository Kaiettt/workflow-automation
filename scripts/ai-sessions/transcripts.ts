import fs from 'node:fs';
import path from 'node:path';
import { digest, json, record, text, timestamp, within } from './common.ts';
import type { Session, Source } from './types.ts';

export function readSession(source: Source, workspace: string): Session {
  const full = path.join(path.dirname(source.path), 'transcript_full.jsonl');
  const input = source.provider === 'antigravity' && fs.existsSync(full) ? full : source.path;
  if (!fs.existsSync(input)) throw new Error('Transcript unavailable; existing logs preserved');
  const modifiedAt = fs.statSync(input).mtime.toISOString();
  if (source.provider === 'cursor') return parseCursor(source, workspace, input, modifiedAt);
  const warnings: string[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const [index, line] of fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '').split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (record(value)) rows.push({ ...value, _row: index });
      else warnings.push('Non-object transcript row ' + index);
    } catch {
      warnings.push('Incomplete or invalid transcript row ' + index + '; previously saved events retained');
    }
  }
  const session: Session = { version: 1, provider: source.provider, sessionId: source.sessionId || path.basename(input, path.extname(input)),
    workspace, model: 'auto', events: [], sources: [input], warnings, modifiedAt };
  if (source.provider === 'codex') { parseCodex(session, rows); return session; }
  if (source.provider === 'claude') { parseClaude(session, rows); return session; }
  if (source.provider !== 'antigravity') throw new Error('Native parser not implemented yet');
  const system = path.resolve(path.dirname(input), '..');
  for (const row of rows) {
    const step = typeof row.step_index === 'number' ? row.step_index : Number(row._row);
    const at = timestamp(row.created_at, modifiedAt);
    const content = text(row.content);
    if (row.type === 'USER_INPUT' || row.type === 'PLANNER_RESPONSE') {
      const kind = row.type === 'USER_INPUT' ? 'user' : 'assistant';
      const prompt = kind === 'user' ? /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(content)?.[1]?.trim() ?? content : content;
      if (prompt) session.events.push({ id: kind + ':' + step, kind, timestamp: at, content: prompt, stepIndex: step, order: step });
      if (row.type === 'PLANNER_RESPONSE' && Array.isArray(row.tool_calls)) {
        for (const [index, call] of row.tool_calls.entries()) {
          if (record(call)) session.events.push({ id: 'tool_call:' + step + ':' + index, kind: 'tool_call',
            timestamp: at, content: text(call.name), data: json({ name: call.name, args: call.args }),
            stepIndex: step, order: step + (index + 1) / 10000 });
        }
      }
    } else if (row.type === 'GENERIC' || row.type === 'ERROR_MESSAGE') {
      session.events.push({ id: 'result:' + step, kind: row.type === 'GENERIC' ? 'tool_result' : 'error',
        timestamp: at, content: content || text(row.error) || '(Native output unavailable or empty)',
        data: json({ status: row.status, error: row.error, source: row.source }),
        stepIndex: step, order: step });
      if (row.type === 'GENERIC' && Number.isSafeInteger(step) && step >= 0) {
        const files = [
          ['output', path.join(system, 'steps', String(step), 'output.txt')],
          ['background', path.join(system, 'tasks', 'task-' + step + '.log')],
        ];
        for (const [index, pair] of files.entries()) {
          const [label, file] = pair;
          if (!fs.existsSync(file)) continue;
          session.sources.push(file);
          const mtime = fs.statSync(file).mtime.toISOString();
          if (mtime > session.modifiedAt) session.modifiedAt = mtime;
          const output = fs.readFileSync(file, 'utf8');
          if (output) session.events.push({ id: 'result:' + step + ':' + label, kind: 'tool_result',
            timestamp: mtime, content: output, data: { nativeFile: file, outputKind: label },
            stepIndex: step, order: step + (index + 1) / 1000 });
        }
      }
    }
    if (Array.isArray(row.truncated_fields) && row.truncated_fields.length) {
      warnings.push('Native export reports truncated fields at step ' + step);
    }
  }
  if (!session.events.length) throw new Error('Transcript has no visible events; existing logs preserved');
  return session;
}
function visibleText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.filter(record).filter(block => block.type === 'text' || block.type === 'input_text' || block.type === 'output_text')
    .map(block => text(block.text)).join('\n');
}

function parseCodex(session: Session, rows: Record<string, unknown>[]): void {
  const meta = rows.find(row => row.type === 'session_meta');
  if (!meta || !record(meta.payload) || !within(session.workspace, text(meta.payload.cwd))) throw new Error('Codex source has no matching workspace metadata; ignored');
  session.sessionId = text(meta.payload.id) || session.sessionId;
  const hasUserEvents = rows.some(row => row.type === 'event_msg' && record(row.payload) && row.payload.type === 'user_message');
  type Candidate = { content: string; phase: string; origin: 'event' | 'response'; turn: number; order: number; timestamp: string };
  const candidates: Candidate[] = [];
  let turn = 0;
  for (const row of rows) {
    if (!record(row.payload)) continue;
    const payload = row.payload;
    const order = Number(row._row);
    const at = timestamp(row.timestamp, session.modifiedAt);
    if (row.type === 'turn_context' && text(payload.model)) session.model = text(payload.model);
    if (row.type === 'event_msg' && payload.type === 'user_message') {
      turn++;
      session.events.push({ id: 'user:' + order, kind: 'user', content: text(payload.message), timestamp: at, order });
    } else if (row.type === 'event_msg' && payload.type === 'agent_message') {
      candidates.push({ content: text(payload.message), phase: text(payload.phase), origin: 'event', turn, order, timestamp: at });
    } else if (row.type === 'response_item') {
      const callId = text(payload.call_id) || text(payload.id) || String(order);
      if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
        let input: unknown = payload.type === 'custom_tool_call' ? payload.input : payload.arguments;
        if (payload.type === 'function_call' && typeof input === 'string') {
          try { input = JSON.parse(input); }
          catch { session.warnings.push('Native tool arguments are not valid JSON for call ' + callId + '; original text retained'); }
        }
        session.events.push({ id: 'call:' + callId, kind: 'tool_call', callId, content: text(payload.name),
          data: json({ name: payload.name, namespace: payload.namespace, input }), timestamp: at, order });
      } else if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
        session.events.push({ id: 'result:' + callId, kind: 'tool_result', callId, content: visibleText(payload.output),
          data: json({ output: payload.output, status: payload.status }), timestamp: at, order });
        if (payload.output === undefined) session.warnings.push('Native tool result unavailable for call ' + callId);
        if (typeof payload.output === 'string' && /Warning: truncated output|original token count:[\s\S]*truncated/i.test(payload.output)) {
          session.warnings.push('Native tool output was truncated for call ' + callId);
        }
      } else if (payload.type === 'message') {
        const content = visibleText(payload.content);
        if (payload.role === 'user' && !hasUserEvents) {
          turn++;
          session.events.push({ id: 'user:' + order, kind: 'user', content, timestamp: at, order });
        } else if (payload.role === 'assistant') {
          candidates.push({ content, phase: text(payload.phase), origin: 'response', turn, order, timestamp: at });
        }
      }
    }
  }
  const matched = new Set<number>();
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    if (!candidate.content) continue;
    if (candidate.origin === 'response') {
      const counterpart = candidates.findIndex((other, index) => !matched.has(index) && other.origin === 'event'
        && other.turn === candidate.turn && other.content === candidate.content
        && (!other.phase || !candidate.phase || other.phase === candidate.phase));
      if (counterpart >= 0) { matched.add(counterpart); continue; }
    }
    const key = candidate.turn + ':' + digest(candidate.content);
    const occurrence = counts.get(key) ?? 0;
    counts.set(key, occurrence + 1);
    session.events.push({ id: 'assistant:' + key + ':' + occurrence, kind: 'assistant', content: candidate.content,
      timestamp: candidate.timestamp, phase: candidate.phase || 'message', order: candidate.order });
  }
}
function parseClaude(session: Session, rows: Record<string, unknown>[]): void {
  let associated = false;
  for (const row of rows) {
    if (row.type !== 'user' && row.type !== 'assistant') continue;
    if (text(row.cwd)) associated = within(session.workspace, text(row.cwd));
    if (!associated || !record(row.message)) continue;
    session.sessionId = text(row.sessionId) || session.sessionId;
    if (text(row.message.model)) session.model = text(row.message.model);
    const order = Number(row._row);
    const at = timestamp(row.timestamp, session.modifiedAt);
    const rowId = text(row.uuid) || String(order);
    const kind = row.type === 'user' ? 'user' : 'assistant';
    const blocks: unknown[] = typeof row.message.content === 'string' ? [{ type: 'text', text: row.message.content }]
      : Array.isArray(row.message.content) ? row.message.content : [];
    for (const [index, block] of blocks.entries()) {
      if (!record(block)) continue;
      if (block.type === 'text') {
        session.events.push({ id: kind + ':' + rowId + ':' + index, kind, content: text(block.text), timestamp: at, order: order + index / 10000 });
      } else if (block.type === 'tool_use') {
        const callId = text(block.id) || rowId + ':' + index;
        session.events.push({ id: 'call:' + callId, kind: 'tool_call', callId, content: text(block.name),
          data: json({ name: block.name, input: block.input }), timestamp: at, order: order + index / 10000 });
      } else if (block.type === 'tool_result') {
        const callId = text(block.tool_use_id) || rowId + ':' + index;
        session.events.push({ id: 'result:' + callId, kind: 'tool_result', callId, content: visibleText(block.content),
          data: json({ result: block.content, isError: block.is_error, toolUseResult: row.toolUseResult }),
          timestamp: at, order: order + index / 10000 });
        if (block.content === undefined && row.toolUseResult === undefined) session.warnings.push('Native tool result unavailable for call ' + callId);
      }
    }
  }
  if (!session.events.length) throw new Error('Claude source has no visible events for this workspace; existing logs preserved');
}
function parseCursor(source: Source, workspace: string, input: string, modifiedAt: string): Session {
  if (!source.workspace || !within(workspace, source.workspace)) throw new Error('Cursor transcript needs an explicit matching workspace binding');
  const session: Session = { version: 1, provider: 'cursor', workspace,
    sessionId: source.sessionId || path.basename(input, '.txt'), model: 'auto', modifiedAt,
    events: [], sources: [input], warnings: [] };
  let kind: 'user' | 'assistant' | 'tool_call' | 'tool_result' | undefined;
  let start = 0;
  let lines: string[] = [];
  function flush(): void {
    if (!kind) return;
    let content = lines.join('\n').trim();
    if (kind === 'user') content = /<user_query>([\s\S]*?)<\/user_query>/.exec(content)?.[1]?.trim() ?? content;
    if (!content && kind === 'tool_result') {
      content = '(Native tool result content unavailable in Cursor export)';
      session.warnings.push('Native tool result content unavailable at transcript line ' + start);
    }
    if (content) session.events.push({ id: kind + ':' + start, kind, content, timestamp: modifiedAt, order: start });
  }
  for (const [index, line] of fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '').split('\n').entries()) {
    const role = /^(user|assistant):\s*(.*)$/.exec(line);
    const tool = /^\[Tool (call|result)\]\s*(.*)$/.exec(line);
    if (role || tool || line === '[Thinking]') {
      flush();
      kind = line === '[Thinking]' ? undefined : role ? (role[1] === 'user' ? 'user' : 'assistant')
        : tool?.[1] === 'call' ? 'tool_call' : 'tool_result';
      start = index;
      lines = [role?.[2] ?? tool?.[2] ?? ''];
    } else lines.push(line);
  }
  flush();
  if (!session.events.length) throw new Error('Cursor export has no visible events; existing logs preserved');
  return session;
}