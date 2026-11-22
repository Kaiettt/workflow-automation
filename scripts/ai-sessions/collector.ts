import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { atomicWrite, errorText, filename, list, provider, readJson, record, text, within } from './common.ts';
import { discover } from './discovery.ts';
import { readSession } from './transcripts.ts';
import { registerSource, refreshLatest, restoreSavedSession, saveSession, withStoreLock } from './store.ts';
import type { CollectOptions, Provider, Source } from './types.ts';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), path.basename(path.dirname(fileURLToPath(import.meta.url))) === 'dist' ? '../../..' : '../..');

export function option(args: string[], name: string): string {
  const index = args.indexOf(name);
  if (index < 0) return '';
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing value for ' + name);
  return args[index + 1];
}

export async function runHook(raw: string, args: string[]): Promise<Record<string, string>> {
  let context: Record<string, unknown> = {};
  let selected: Provider = 'antigravity';
  try {
    const value: unknown = raw.trim() ? JSON.parse(raw) : {};
    if (!record(value)) throw new Error('Invalid hook context');
    context = value;
    selected = provider(option(args, '--provider') || (context.transcript_path ? 'claude' : 'antigravity'));
    const workspace = path.resolve(option(args, '--workspace') || repositoryRoot);
    const paths = Array.isArray(context.workspacePaths) ? context.workspacePaths.map(text) : [text(context.cwd)];
    if (!paths.some(candidate => within(workspace, candidate))) throw new Error('Hook belongs to another workspace; ignored');
    const source: Source = { provider: selected, path: text(context.transcriptPath) || text(context.transcript_path),
      sessionId: text(context.conversationId) || text(context.session_id), workspace };
    if (!source.path || !source.sessionId) throw new Error('Transcript path or session ID unavailable; existing logs preserved');
    const session = readSession(source, workspace);
    if (text(context.modelName)) session.model = text(context.modelName);
    await withStoreLock(workspace, () => { registerSource(workspace, source); saveSession(session); });
  } catch (error) {
    process.stderr.write('[ai-sessions] ' + errorText(error) + '\n');
  }
  return selected === 'antigravity' && (!text(context.hookEventName) || context.hookEventName === 'Stop') ? { decision: 'stop' } : {};
}

export interface Report {
  workspace: string;
  pid: number;
  collectedAt: string;
  sessions: number;
  events: number;
  changed: number;
  available: Record<Provider, number>;
  warnings: string[];
}

interface CacheEntry { signature: string; file: string; events: number; sessionId: string; warnings: string[]; }
function signature(source: Source, workspace: string): string {
  const files = [source.path];
  if (source.provider === 'antigravity') {
    const system = path.resolve(path.dirname(source.path), '..');
    files.push(path.join(path.dirname(source.path), 'transcript_full.jsonl'));
    for (const entry of list(path.join(system, 'steps'))) if (entry.isDirectory()) files.push(path.join(system, 'steps', entry.name, 'output.txt'));
    for (const entry of list(path.join(system, 'tasks'))) if (entry.isFile()) files.push(path.join(system, 'tasks', entry.name));
    if (source.sessionId) files.push(path.join(workspace, 'logs/ai-sessions/session-' + filename(source.sessionId.slice(0, 8)) + '.md'));
  }
  return files.map(file => {
    if (!fs.existsSync(file)) return file + ':missing';
    const stat = fs.statSync(file);
    return file + ':' + stat.size + ':' + stat.mtimeMs;
  }).join('|');
}

export async function collectOnce(options: CollectOptions, cache?: Map<string, CacheEntry>): Promise<Report> {
  const found = discover(options);
  const result: Report = { workspace: options.workspace, pid: process.pid, collectedAt: new Date().toISOString(),
    sessions: 0, events: 0, changed: 0, available: found.available, warnings: [...found.warnings] };
  const totals = new Map<string, number>();
  const changed = new Set<string>();
  for (const source of found.sources) {
    const sourceKey = source.provider + ':' + path.resolve(source.path);
    const previous = cache?.get(sourceKey);
    try {
      const before = signature(source, options.workspace);
      if (previous?.signature === before) {
        totals.set(source.provider + ':' + previous.sessionId, previous.events);
        result.warnings.push(...previous.warnings);
        continue;
      }
      const session = readSession(source, options.workspace);
      const saved = await withStoreLock(options.workspace, () => { registerSource(options.workspace, { ...source, sessionId: session.sessionId, workspace: options.workspace }); return saveSession(session); });
      const key = source.provider + ':' + session.sessionId;
      totals.set(key, saved.events);
      if (saved.changed) changed.add(key);
      const warnings = session.warnings.map(warning => source.provider + ': ' + warning);
      result.warnings.push(...warnings);
      cache?.set(sourceKey, { signature: signature(source, options.workspace), file: saved.file, events: saved.events, sessionId: session.sessionId, warnings });
    } catch (error) {
      result.warnings.push(source.provider + ': ' + errorText(error));
      if (previous && fs.existsSync(previous.file)) {
        await withStoreLock(options.workspace, () => restoreSavedSession(previous.file, options.workspace));
        totals.set(source.provider + ':' + previous.sessionId, previous.events);
      }
    }
  }
  await withStoreLock(options.workspace, () => refreshLatest(options.workspace));
  result.sessions = totals.size;
  result.events = [...totals.values()].reduce((sum, count) => sum + count, 0);
  result.changed = changed.size;
  result.warnings = [...new Set(result.warnings)];
  atomicWrite(path.join(options.workspace, 'logs/ai-sessions/.state/status.json'), JSON.stringify(result, null, 2));
  return result;
}

interface Owner { pid: number; token: string; startedAt: string; workspace: string; }
function ownerFile(workspace: string): string { return path.join(workspace, 'logs/ai-sessions/.state/collector.json'); }
function owner(workspace: string): Owner | undefined {
  const file = ownerFile(workspace);
  if (!fs.existsSync(file)) return undefined;
  const value = readJson(file);
  if (!record(value) || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid <= 0 || !text(value.token)) throw new Error('Invalid collector ownership file; existing state preserved');
  return { pid: value.pid, token: text(value.token), startedAt: text(value.startedAt), workspace: text(value.workspace) };
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (record(error) && error.code === 'ESRCH') return false;
    if (record(error) && error.code === 'EPERM') return true;
    throw error;
  }
}

async function watch(options: CollectOptions, interval: number): Promise<void> {
  const file = ownerFile(options.workspace);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let ownership: Owner | undefined;
  for (let attempt = 0; attempt < 20 && !ownership; attempt++) {
    try {
      const descriptor = fs.openSync(file, 'wx', 0o600);
      ownership = { pid: process.pid, token: randomUUID(), startedAt: new Date().toISOString(), workspace: options.workspace };
      try { fs.writeFileSync(descriptor, JSON.stringify(ownership)); }
      finally { fs.closeSync(descriptor); }
    } catch (error) {
      if (!record(error) || error.code !== 'EEXIST') throw error;
      let existing: Owner | undefined;
      try { existing = owner(options.workspace); }
      catch (readError) {
        if (attempt === 19) throw readError;
        await delay(50);
        continue;
      }
      if (existing && alive(existing.pid)) {
        process.stdout.write(JSON.stringify({ running: true, alreadyRunning: true, pid: existing.pid }) + '\n');
        return;
      }
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  if (!ownership) throw new Error('Collector startup is busy; retry later');
  const own = ownership;
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const stopFile = path.join(path.dirname(file), 'stop.json');
  const cache = new Map<string, CacheEntry>();
  let lastMessage = '';
  try {
    while (!stopping) {
      if (fs.existsSync(stopFile)) {
        const request = readJson(stopFile);
        if (record(request) && request.token === own.token) break;
      }
      const report = await collectOnce(options, cache);
      atomicWrite(file, JSON.stringify({ ...own, heartbeat: new Date().toISOString() }));
      const message = JSON.stringify({ sessions: report.sessions, events: report.events, warnings: report.warnings });
      if (message !== lastMessage || report.changed > 0) {
        process.stdout.write(JSON.stringify(report) + '\n');
        lastMessage = message;
      }
      await delay(interval);
    }
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    if (owner(options.workspace)?.token === own.token) fs.unlinkSync(file);
    if (fs.existsSync(stopFile)) {
      const request = readJson(stopFile);
      if (record(request) && request.token === own.token) fs.unlinkSync(stopFile);
    }
  }
}

export async function main(args: string[]): Promise<void> {
  const valued = new Set(['--workspace', '--home', '--source', '--provider', '--session', '--interval']);
  const flags = new Set(['--watch', '--status', '--stop', '--help']);
  for (let index = 0; index < args.length; index++) {
    if (valued.has(args[index])) { option(args, args[index]); index++; }
    else if (!flags.has(args[index])) throw new Error('Unknown option: ' + args[index]);
  }
  const workspace = path.resolve(option(args, '--workspace') || repositoryRoot);
  if (args.includes('--help')) {
    process.stdout.write('AI session collector: --watch | --status | --stop; --workspace <path>; --home <path>; --source <path> --provider <antigravity|codex|claude|cursor> [--session <id>]\n');
    return;
  }
  if (args.includes('--status')) {
    const file = path.join(workspace, 'logs/ai-sessions/.state/status.json');
    const saved = fs.existsSync(file) ? readJson(file) : {};
    const active = owner(workspace);
    process.stdout.write(JSON.stringify({ ...(record(saved) ? saved : {}), workspace, running: !!active && alive(active.pid), collectorPid: active?.pid ?? null }) + '\n');
    return;
  }
  if (args.includes('--stop')) {
    const active = owner(workspace);
    if (active && alive(active.pid)) atomicWrite(path.join(workspace, 'logs/ai-sessions/.state/stop.json'), JSON.stringify({ token: active.token }));
    process.stdout.write(JSON.stringify({ stopRequested: !!active && alive(active.pid) }) + '\n');
    return;
  }
  const sourcePath = option(args, '--source');
  const options: CollectOptions = { workspace, home: path.resolve(option(args, '--home') || os.homedir()),
    ...(sourcePath ? { sources: [{ provider: provider(option(args, '--provider')), path: path.resolve(sourcePath),
      sessionId: option(args, '--session'), workspace }] } : {}) };
  if (args.includes('--watch')) {
    const interval = Number(option(args, '--interval') || '2000');
    if (!Number.isSafeInteger(interval) || interval < 100 || interval > 60_000) throw new Error('Interval must be 100..60000 milliseconds');
    await watch(options, interval);
  } else process.stdout.write(JSON.stringify(await collectOnce(options)) + '\n');
}