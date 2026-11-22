import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function workspaceFixture(t: TestContext): string {
  const parent = path.resolve(os.tmpdir());
  const workspace = fs.mkdtempSync(path.join(parent, 'ai-session-test-'));
  t.after(() => {
    const relative = path.relative(parent, path.resolve(workspace));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.ok(path.basename(workspace).startsWith('ai-session-test-'));
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  return workspace;
}
export function writeJSONL(file: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
}
export function invokeHook(workspace: string, transcriptPath: string) {
  return rawHook(workspace, { conversationId: 'probe001-session', workspacePaths: [workspace], transcriptPath, hookEventName: 'Stop' });
}
export function rawHook(workspace: string, context: Record<string, unknown>, provider = 'antigravity') {
  const entry = process.env.AI_SESSION_TEST_HOOK || fileURLToPath(new URL('./hook.cjs', import.meta.url));
  const result = spawnSync(process.execPath, [entry, '--workspace', workspace, '--provider', provider], {
    input: JSON.stringify(context), encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const response: unknown = JSON.parse(result.stdout);
  assert.deepEqual(response, provider === 'antigravity' && (!context.hookEventName || context.hookEventName === 'Stop') ? { decision: 'stop' } : {});
  return result;
}
export function cli(workspace: string, home: string, extra: string[] = []) {
  const entry = fileURLToPath(new URL('./cli.cjs', import.meta.url));
  const result = spawnSync(process.execPath, [entry, '--workspace', workspace, '--home', home, ...extra], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(object(report));
  return report;
}
export function document(workspace: string, name: string): Record<string, unknown> & { events: unknown[] } {
  const result: unknown = JSON.parse(fs.readFileSync(path.join(workspace, 'logs/ai-sessions', name), 'utf8'));
  assert.ok(object(result) && Array.isArray(result.events));
  const events: unknown = result.events;
  assert.ok(Array.isArray(events));
  return { ...result, events };
}