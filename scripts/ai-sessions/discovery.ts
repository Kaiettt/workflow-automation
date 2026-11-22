import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { list, readJson, record, text, within } from './common.ts';
import type { CollectOptions, Provider, Source } from './types.ts';

export interface Discovery { sources: Source[]; warnings: string[]; available: Record<Provider, number>; }

function headerRows(file: string): Record<string, unknown>[] {
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  let length: number;
  try { length = fs.readSync(descriptor, buffer, 0, buffer.length, 0); }
  finally { fs.closeSync(descriptor); }
  const rows: Record<string, unknown>[] = [];
  for (const line of buffer.toString('utf8', 0, length).replace(/^\uFEFF/, '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row: unknown = JSON.parse(line);
      if (record(row)) rows.push(row);
    } catch {
      // A prefix can end inside an appended or large record; it is not imported.
      break;
    }
    if (rows.length >= 30) break;
  }
  return rows;
}

function walk(directory: string, depth: number, accept: (file: string) => void): void {
  if (depth < 0) return;
  for (const entry of list(directory)) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, depth - 1, accept);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) accept(file);
  }
}

export function discover(options: CollectOptions): Discovery {
  const result: Discovery = { sources: [], warnings: [], available: { antigravity: 0, codex: 0, claude: 0, cursor: 0 } };
  const keys = new Set<string>();
  function add(source: Source): void {
    const key = source.provider + ':' + path.resolve(source.path);
    if (!keys.has(key)) { keys.add(key); result.sources.push(source); result.available[source.provider]++; }
  }
  if (options.sources) {
    for (const source of options.sources) add(source);
    return result;
  }
  const registry = path.join(options.workspace, 'logs/ai-sessions/.state/sources.json');
  if (fs.existsSync(registry)) {
    const saved = readJson(registry);
    if (Array.isArray(saved)) for (const item of saved) {
      if (record(item) && (item.provider === 'antigravity' || item.provider === 'codex' || item.provider === 'claude' || item.provider === 'cursor')
        && within(options.workspace, text(item.workspace))) {
        add({ provider: item.provider, path: text(item.path), sessionId: text(item.sessionId), workspace: options.workspace });
      }
    }
  }
  const nativeRoots = ['antigravity', 'antigravity-ide', 'antigravity-cli'].map(name => path.join(options.home, '.gemini', name, 'brain'));
  const ids = new Set<string>();
  for (const entry of list(path.join(options.workspace, 'logs/ai-sessions'))) {
    if (!entry.isFile() || !/^session-[a-zA-Z0-9_-]{1,8}\.md$/.test(entry.name)) continue;
    const content = fs.readFileSync(path.join(options.workspace, 'logs/ai-sessions', entry.name), 'utf8').slice(0, 4096);
    const id = /\*\*Conversation ID\*\*:\s*\x60([^\x60]+)\x60/.exec(content)?.[1];
    if (id && !id.includes('/') && !id.includes('\\')) ids.add(id);
  }
  for (const name of ['antigravity', 'antigravity-ide', 'antigravity-cli']) {
    const database = path.join(options.home, '.gemini', name, 'conversation_summaries.db');
    if (!fs.existsSync(database)) continue;
    try { for (const id of boundAntigravityIds(options, database)) ids.add(id); }
    catch (error) { result.warnings.push('Antigravity metadata discovery failed: ' + (error instanceof Error ? error.message : 'unknown error')); }
  }
  for (const id of ids) for (const root of nativeRoots) {
    const log = path.join(root, id, '.system_generated/logs/transcript.jsonl');
    const full = path.join(path.dirname(log), 'transcript_full.jsonl');
    if (fs.existsSync(log) || fs.existsSync(full)) add({ provider: 'antigravity', path: log, sessionId: id, workspace: options.workspace });
  }
  try {
    walk(path.join(options.home, '.codex/sessions'), 4, file => {
      const meta = headerRows(file).find(row => row.type === 'session_meta');
      if (meta && record(meta.payload) && within(options.workspace, text(meta.payload.cwd))) {
        add({ provider: 'codex', path: file, sessionId: text(meta.payload.id), workspace: options.workspace });
      }
    });
  } catch (error) { result.warnings.push('Codex source discovery failed: ' + (error instanceof Error ? error.message : 'unknown error')); }
  const claudeSlug = options.workspace.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const claudeRoot = path.join(options.home, '.claude/projects');
  for (const project of list(claudeRoot)) {
    if (!project.isDirectory() || !(project.name.toLowerCase() === claudeSlug || project.name.toLowerCase().startsWith(claudeSlug + '-'))) continue;
    walk(path.join(claudeRoot, project.name), 2, file => {
      const row = headerRows(file).find(item => within(options.workspace, text(item.cwd)));
      if (row) add({ provider: 'claude', path: file, sessionId: text(row.sessionId) || path.basename(file, '.jsonl'), workspace: options.workspace });
    });
  }
  const cursorSlug = options.workspace.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cursorRoot = path.join(options.home, '.cursor/projects');
  for (const project of list(cursorRoot)) {
    if (!project.isDirectory() || project.name.toLowerCase() !== cursorSlug) continue;
    const transcripts = path.join(cursorRoot, project.name, 'agent-transcripts');
    for (const entry of list(transcripts)) {
      if (entry.isFile() && entry.name.endsWith('.txt')) add({ provider: 'cursor', path: path.join(transcripts, entry.name),
        sessionId: path.basename(entry.name, '.txt'), workspace: options.workspace });
    }
  }
  return result;
}
const bindingCache = new Map<string, { signature: string; ids: string[] }>();

function databaseSignature(file: string): string {
  return [file, file + '-wal'].map(candidate => {
    if (!fs.existsSync(candidate)) return '';
    const stat = fs.statSync(candidate);
    return stat.size + ':' + stat.mtimeMs;
  }).join('|');
}

function boundAntigravityIds(options: CollectOptions, databaseFile: string): string[] {
  const signature = databaseSignature(databaseFile);
  const key = options.workspace + ':' + databaseFile;
  const cached = bindingCache.get(key);
  if (cached?.signature === signature) return cached.ids;
  const state = path.join(options.workspace, 'logs/ai-sessions/.state');
  fs.mkdirSync(state, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(state, 'native-binding-'));
  const snapshot = path.join(temporary, 'snapshot.db');
  let database: DatabaseSync | undefined;
  try {
    fs.copyFileSync(databaseFile, snapshot);
    if (fs.existsSync(databaseFile + '-wal')) fs.copyFileSync(databaseFile + '-wal', snapshot + '-wal');
    if (databaseSignature(databaseFile) !== signature) throw new Error('Antigravity binding metadata changed during snapshot; retrying on next collection');
    database = new DatabaseSync(snapshot, { readOnly: true });
    const rows = database.prepare('SELECT conversation_id, workspace_uris FROM conversation_summaries').all();
    const ids: string[] = [];
    for (const row of rows) {
      const id = text(row.conversation_id);
      if (!id || id.includes('/') || id.includes('\\')) continue;
      const uris: unknown = JSON.parse(text(row.workspace_uris) || '[]');
      if (!Array.isArray(uris)) continue;
      if (uris.some((uri: unknown) => typeof uri === 'string' && uri.startsWith('file:')
        && within(options.workspace, fileURLToPath(uri)))) ids.push(id);
    }
    bindingCache.set(key, { signature, ids });
    return ids;
  } finally {
    try { database?.close(); }
    finally {
      removeBindingSnapshot(state, temporary);
    }
  }
}
function removeBindingSnapshot(state: string, temporary: string): void {
  const relative = path.relative(path.resolve(state), path.resolve(temporary));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(temporary).startsWith('native-binding-')) {
    throw new Error('Binding snapshot cleanup target is outside its intended workspace state directory');
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}