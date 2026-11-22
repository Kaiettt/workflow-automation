import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { atomicWrite, digest, filename, json, readJson, record, redactText, text, provider as validatedProvider } from './common.ts';
import type { EventKind, Json, LogEvent, Session, Source } from './types.ts';

function kind(value: unknown): value is EventKind {
  return value === 'user' || value === 'assistant' || value === 'tool_call' || value === 'tool_result' || value === 'error';
}
function storedSession(value: unknown): Session {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.events)) throw new Error('Invalid saved session; preserving existing files');
  const events: LogEvent[] = [];
  for (const item of value.events) {
    if (!record(item) || !kind(item.kind) || !text(item.id)) throw new Error('Invalid saved event; preserving existing files');
    events.push({ id: text(item.id), kind: item.kind, timestamp: text(item.timestamp), content: text(item.content),
      ...(item.data !== undefined ? { data: json(item.data) } : {}),
      ...(typeof item.callId === 'string' ? { callId: item.callId } : {}),
      ...(typeof item.stepIndex === 'number' ? { stepIndex: item.stepIndex } : {}),
      ...(typeof item.phase === 'string' ? { phase: item.phase } : {}), ...(typeof item.order === 'number' ? { order: item.order } : {}) });
  }
  if (value.provider !== 'antigravity' && value.provider !== 'codex' && value.provider !== 'claude' && value.provider !== 'cursor') throw new Error('Invalid saved provider');
  return { version: 1, provider: value.provider, sessionId: text(value.sessionId), workspace: text(value.workspace),
    model: text(value.model), modifiedAt: text(value.modifiedAt), events,
    sources: Array.isArray(value.sources) ? value.sources.map(text).filter(Boolean) : [],
    warnings: Array.isArray(value.warnings) ? value.warnings.map(text).filter(Boolean) : [] };
}

export async function withStoreLock<T>(workspace: string, action: () => T | Promise<T>): Promise<T> {
  const state = path.join(workspace, 'logs/ai-sessions/.state');
  const lock = path.join(state, 'store.lock');
  const ownerPath = path.join(lock, 'owner.json');
  fs.mkdirSync(state, { recursive: true });
  const deadline = Date.now() + 10_000;
  let acquired = false;
  while (!acquired) {
    try {
      fs.mkdirSync(lock);
      acquired = true;
    } catch (error) {
      if (!record(error) || error.code !== 'EEXIST') throw error;
      let stale = false;
      if (fs.existsSync(ownerPath)) {
        const owner = readJson(ownerPath);
        if (record(owner) && typeof owner.pid === 'number') {
          try { process.kill(owner.pid, 0); }
          catch (probeError) {
            if (record(probeError) && probeError.code === 'ESRCH') stale = true;
            else if (!record(probeError) || probeError.code !== 'EPERM') throw probeError;
          }
        }
      } else {
        stale = Date.now() - fs.statSync(lock).mtimeMs > 60_000;
      }
      if (stale) {
        if (fs.existsSync(ownerPath)) fs.unlinkSync(ownerPath);
        fs.rmdirSync(lock);
        continue;
      }
      if (Date.now() >= deadline) throw new Error('Session store is busy; existing files are preserved');
      await delay(50);
    }
  }
  fs.writeFileSync(ownerPath, JSON.stringify({ pid: process.pid }));
  try { return await action(); }
  finally {
    fs.unlinkSync(ownerPath);
    fs.rmdirSync(lock);
  }
}

function mergeData(old: Json | undefined, fresh: Json | undefined): Json | undefined {
  if (fresh === undefined || (fresh === null && old !== undefined)) return old;
  if (Array.isArray(old) && Array.isArray(fresh)) return Array.from({ length: Math.max(old.length, fresh.length) }, (_, index) => mergeData(old[index], fresh[index]) ?? null);
  if (typeof old === 'string' && typeof fresh === 'string') return fresh.length >= old.length ? fresh : old;
  if (record(old) && record(fresh)) {
    const merged: { [key: string]: Json } = {};
    for (const [key, value] of Object.entries(old)) merged[key] = json(value);
    for (const [key, value] of Object.entries(fresh)) merged[key] = mergeData(merged[key], json(value)) ?? null;
    return merged;
  }
  return fresh;
}

function code(value: string): string {
  const runs = value.match(/\x60+/g) ?? [];
  const fence = '\x60'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  return fence + '\n' + value + '\n' + fence + '\n';
}

export function markdown(session: Session): string {
  let output = '# AI Session Log\n\n';
  output += '- **Conversation ID**: \x60' + session.sessionId + '\x60\n';
  output += '- **Provider**: ' + session.provider + '\n- **Workspace**: ' + session.workspace + '\n';
  output += '- **Last Updated**: ' + session.modifiedAt + '\n- **Model**: ' + session.model + '\n';
  output += '- **Total Turns**: ' + session.events.filter(event => event.kind === 'user').length + '\n';
  for (const warning of session.warnings) output += '- **Collection note**: ' + warning + '\n';
  output += '\n---\n\n';
  let turn = 0;
  for (const event of session.events) {
    if (event.kind === 'user') output += '## Turn ' + (++turn) + '\n\n';
    const title = event.kind === 'user' ? 'Prompt' : event.kind === 'assistant' ? 'AI Output' : event.kind === 'tool_call' ? 'Tool Call' : event.kind === 'tool_result' ? 'Tool Result' : 'Error';
    output += '### ' + title + (event.phase ? ' (' + event.phase + ')' : '') + '\n\n';
    if (event.callId) output += 'Call ID: \x60' + event.callId + '\x60\n\n';
    if (event.stepIndex !== undefined) output += 'Step: ' + event.stepIndex + '\n\n';
    if (event.content) output += event.kind === 'tool_result' ? code(event.content) + '\n' : event.content + '\n\n';
    if (event.data !== undefined) output += code(JSON.stringify(event.data, null, 2)) + '\n' + imageLinks(event.data).join('\n') + '\n';
  }
  return output;
}

export function saveSession(session: Session): { changed: boolean; file: string; events: number } {
  session = { ...session, events: session.events.map(event => ({ ...event, content: redactText(event.content), ...(event.data !== undefined ? { data: materialize(json(event.data), path.join(session.workspace, 'logs/ai-sessions')) } : {}) })) };
  const output = path.join(session.workspace, 'logs/ai-sessions');
  const base = 'session-' + session.provider + '-' + filename(session.sessionId);
  const dataPath = path.join(output, base + '.json');
  const previous = fs.existsSync(dataPath) ? storedSession(readJson(dataPath)) : undefined;
  const merged = new Map(previous?.events.map(event => [event.id, event]) ?? []);
  for (const event of session.events) {
    const old = merged.get(event.id);
    merged.set(event.id, old ? { ...old, ...event,
      content: event.content.length >= old.content.length ? event.content : old.content,
      ...(mergeData(old.data, event.data) !== undefined ? { data: mergeData(old.data, event.data) } : {}) } : event);
  }
  const result: Session = { ...session, model: session.model === 'auto' ? previous?.model ?? session.model : session.model,
    events: [...merged.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), sources: [...new Set([...(previous?.sources ?? []), ...session.sources])],
    warnings: [...new Set(session.warnings)],
    modifiedAt: session.modifiedAt > (previous?.modifiedAt ?? '') ? session.modifiedAt : previous?.modifiedAt ?? session.modifiedAt };
  if (result.events.length === 0) return { changed: false, file: dataPath, events: 0 };
  const encoded = JSON.stringify(result, null, 2) + '\n';
  const changed = !previous || JSON.stringify(previous, null, 2) + '\n' !== encoded;
  const md = markdown(result);
  if (changed) { atomicWrite(dataPath, encoded); atomicWrite(path.join(output, base + '.md'), md); }
  if (result.provider === 'antigravity') {
    const alias = path.join(output, 'session-' + filename(result.sessionId.slice(0, 8)) + '.md');
    const oldAlias = fs.existsSync(alias) ? fs.readFileSync(alias, 'utf8') : '';
    if (!oldAlias.trim() || oldAlias.includes('**Conversation ID**: \x60' + result.sessionId + '\x60')) {
      if (oldAlias !== md) atomicWrite(alias, md);
    }
  }
  const latestPath = path.join(output, '.state/latest.json');
  const latest = fs.existsSync(latestPath) ? readJson(latestPath) : undefined;
  if (!record(latest) || text(latest.modifiedAt) <= result.modifiedAt) {
    atomicWrite(path.join(output, 'latest.md'), md);
    atomicWrite(latestPath, JSON.stringify({ sessionId: result.sessionId, provider: result.provider, modifiedAt: result.modifiedAt }));
  }
  return { changed, file: dataPath, events: result.events.length };
}

export function registerSource(workspace: string, source: Source): void {
  const file = path.join(workspace, 'logs/ai-sessions/.state/sources.json');
  const data = fs.existsSync(file) ? readJson(file) : [];
  const sources = Array.isArray(data) ? data.filter(record) : [];
  const key = digest(source.provider + ':' + path.resolve(source.path));
  const existing = sources.find(item => item.key === key);
  if (!existing) { sources.push({ ...source, key }); atomicWrite(file, JSON.stringify(sources, null, 2)); }
}
function materialize(value: Json, directory: string): Json {
  if (Array.isArray(value)) return value.map(item => materialize(item, directory));
  if (!record(value)) return value;
  if (value.type === 'image' && record(value.source) && value.source.type === 'base64') {
    const mediaType = text(value.source.media_type);
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
    const extension = extensions[mediaType];
    const encoded = text(value.source.data).replace(/\s/g, '');
    if (extension && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      const bytes = Buffer.from(encoded, 'base64');
      const name = createHash('sha256').update(bytes).digest('hex') + '.' + extension;
      const file = path.join(directory, 'assets', name);
      if (!fs.existsSync(file)) atomicWrite(file, bytes);
      const result: { [key: string]: Json } = {};
      for (const [key, item] of Object.entries(value)) result[key] = key === 'source'
        ? { type: 'file', media_type: mediaType, path: 'assets/' + name } : materialize(json(item), directory);
      return result;
    }
  }
  const result: { [key: string]: Json } = {};
  for (const [key, item] of Object.entries(value)) result[key] = materialize(json(item), directory);
  return result;
}

function imageLinks(value: Json): string[] {
  if (Array.isArray(value)) return value.flatMap(imageLinks);
  if (!record(value)) return [];
  if (value.type === 'image' && record(value.source) && value.source.type === 'file') {
    const file = text(value.source.path);
    if (file.startsWith('assets/') && !file.includes('..')) return ['[Image output](' + file + ')'];
  }
  return Object.values(value).flatMap(item => imageLinks(json(item)));
}
export function restoreSavedSession(file: string, workspace: string): void {
  const relative = path.relative(path.join(workspace, 'logs/ai-sessions'), path.resolve(file));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Saved session is outside this workspace');
  const session = storedSession(readJson(file));
  if (path.resolve(session.workspace).toLowerCase() !== path.resolve(workspace).toLowerCase()) throw new Error('Saved session belongs to another workspace');
  saveSession(session);
}
export function refreshLatest(workspace: string): void {
  const output = path.join(workspace, 'logs/ai-sessions');
  const metadata = path.join(output, '.state/latest.json');
  if (!fs.existsSync(metadata)) return;
  const value = readJson(metadata);
  if (!record(value)) throw new Error('Invalid latest-session metadata; existing data preserved');
  const client = validatedProvider(value.provider);
  const canonical = path.join(output, 'session-' + client + '-' + filename(text(value.sessionId)) + '.md');
  if (!fs.existsSync(canonical)) return;
  const expected = fs.readFileSync(canonical, 'utf8');
  const latest = path.join(output, 'latest.md');
  if (!fs.existsSync(latest) || fs.readFileSync(latest, 'utf8') !== expected) atomicWrite(latest, expected);
}