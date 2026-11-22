import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Json, Provider } from './types.ts';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
export function readJson(file: string): unknown {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try { return JSON.parse(input); }
  catch { throw new Error('Invalid JSON file: ' + file); }
}
export function provider(value: unknown): Provider {
  if (value === 'codex' || value === 'claude' || value === 'cursor' || value === 'antigravity') return value;
  throw new Error('Unsupported AI session provider');
}
export function within(workspace: string, candidate: string): boolean {
  if (!candidate) return false;
  const relative = path.relative(path.resolve(workspace), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
export function digest(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 16); }
export function filename(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return safe === value && safe ? safe : (safe || 'session') + '-' + digest(value);
}
export function timestamp(value: unknown, fallback: string): string {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}
export function redactText(value: string): string {
  return value
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, '<REDACTED PRIVATE KEY>')
    .replace(/\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '<REDACTED>')
    .replace(/(\b(?:Authorization\s*:\s*(?:Bearer|Basic)|Bearer)\s+)[^\s"'\x60]+/gi, '$1<REDACTED>')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|secret|token|cookie|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)\s*["']?\s*[:=]\s*)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s"'\x60,;]+)/gi, '$1<REDACTED>')
    .replace(/(--(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|secret|token)\s+)(?:"[^"]*"|'[^']*'|[^\s]+)/gi, '$1<REDACTED>')
    .replace(/(https?:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1<REDACTED>@');
}
const sensitiveKey = /^(?:api[_-]?key|authorization|password|client[_-]?secret|private[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|cookie|set-cookie|aws_secret_access_key|aws_access_key_id)$/i;
export function json(value: unknown): Json {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item: unknown) => json(item));
  if (record(value)) {
    const result: { [key: string]: Json } = Object.create(null);
    for (const [key, item] of Object.entries(value)) result[key] = sensitiveKey.test(key) ? '<REDACTED>' : json(item);
    return result;
  }
  return null;
}
export function errorText(error: unknown): string { return redactText(error instanceof Error ? error.message : 'Unknown collection error'); }
export function atomicWrite(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid + '-' + Math.random().toString(16).slice(2);
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
export function list(directory: string): fs.Dirent[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true });
}