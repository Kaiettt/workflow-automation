import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { record } from './common.ts';

export interface CollectorIdentity { pid: number; startedAt: string; workspace: string; }
interface ProcessIdentity { name: string; command: string; createdAt?: number; }
function inspectProcess(pid: number): ProcessIdentity | undefined {
  if (process.platform === 'win32') {
    const script = `$candidate = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction Stop; if ($null -eq $candidate) { 'null' } else { [pscustomobject]@{ name = $candidate.Name; command = $candidate.CommandLine; createdAt = ([DateTimeOffset]$candidate.CreationDate).ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress }`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
    if (result.status !== 0) throw new Error('Unable to verify collector process identity; existing ownership preserved');
    const value: unknown = JSON.parse(result.stdout);
    if (value === null) return undefined;
    if (!record(value) || typeof value.name !== 'string' || typeof value.createdAt !== 'number') throw new Error('Invalid process identity response; existing ownership preserved');
    if (value.command !== null && typeof value.command !== 'string') throw new Error('Unable to inspect collector command; existing ownership preserved');
    return { name: value.name, command: value.command ?? '', createdAt: value.createdAt };
  }
  const proc = `/proc/${pid}/cmdline`;
  if (fs.existsSync(proc)) {
    const args = fs.readFileSync(proc, 'utf8').split('\0').filter(Boolean);
    return { name: path.basename(args[0] ?? ''), command: args.map(arg => arg.includes(' ') ? '"' + arg + '"' : arg).join(' ') };
  }
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8', timeout: 5000 });
  if (result.status === 1) return undefined;
  if (result.status !== 0) throw new Error('Unable to verify collector process identity; existing ownership preserved');
  return { name: path.basename(process.execPath), command: result.stdout.trim() };
}
function normalized(value: string): string {
  const slashes = value.replaceAll('\\', '/');
  return process.platform === 'win32' ? slashes.toLowerCase() : slashes;
}
export function isCollectorProcess(owner: CollectorIdentity, workspace: string): boolean {
  if (normalized(path.resolve(owner.workspace)) !== normalized(path.resolve(workspace))) return false;
  const startedAt = Date.parse(owner.startedAt);
  if (!Number.isFinite(startedAt)) throw new Error('Invalid collector start time; existing ownership preserved');
  const identity = inspectProcess(owner.pid);
  if (!identity || normalized(path.basename(identity.name)) !== normalized(path.basename(process.execPath))) return false;
  if (!identity.command) throw new Error('Unable to inspect live Node command; existing ownership preserved');
  const createdAt = identity.createdAt ?? (owner.pid === process.pid ? Date.now() - process.uptime() * 1000 : undefined);
  if (createdAt !== undefined && createdAt > startedAt) return false;
  const command = normalized(identity.command);
  const cli = normalized(path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.cjs'));
  if (!(command.includes(cli) || command.includes('scripts/ai-sessions/cli.cjs') || command.includes('scripts/ai-sessions/dist/cli.cjs'))) return false;
  if (!/(?:^|[\s"'])--watch(?:$|[\s"'])/.test(command)) return false;
  const override = command.match(/(?:^|\s)--workspace\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const configuredWorkspace = override?.[1] ?? override?.[2] ?? override?.[3];
  if (configuredWorkspace && path.isAbsolute(configuredWorkspace) && normalized(path.resolve(configuredWorkspace)) !== normalized(path.resolve(workspace))) return false;
  return true;
}
