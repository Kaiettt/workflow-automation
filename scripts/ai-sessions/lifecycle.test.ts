import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cli, workspaceFixture, writeJSONL } from './test-helpers.ts';

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 6000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for automatic collection');
    await delay(50);
  }
}

test('AIS-06: one watcher updates late output and stops through its control command', async (t) => {
  let watcher: ChildProcess | undefined;
  t.after(async () => {
    if (watcher && watcher.exitCode === null) {
      watcher.kill();
      await once(watcher, 'exit');
    }
  });
  const workspace = workspaceFixture(t);
  const home = workspaceFixture(t);
  const native = path.join(home, '.codex/sessions/2026/11/22/rollout-watch.jsonl');
  writeJSONL(native, [
    { type: 'session_meta', payload: { id: 'watch0001', cwd: workspace } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'WATCH_PROMPT' } },
  ]);
  watcher = spawn(process.execPath, [fileURLToPath(new URL('./cli.cjs', import.meta.url)),
    '--workspace', workspace, '--home', home, '--watch', '--interval', '100'], { stdio: 'pipe' });
  const output = path.join(workspace, 'logs/ai-sessions/session-codex-watch0001.md');
  await waitFor(() => fs.existsSync(output));
  await delay(300);
  assert.equal(watcher.exitCode, null, 'Collector must continue running after the initial import');
  fs.appendFileSync(native, JSON.stringify({ type: 'event_msg', payload: { type: 'agent_message', message: 'WATCH_LATE_REPLY', phase: 'final_answer' } }) + '\n');
  await waitFor(() => fs.readFileSync(output, 'utf8').includes('WATCH_LATE_REPLY'));
  fs.writeFileSync(path.join(workspace, 'logs/ai-sessions/latest.md'), 'LEGACY_EMPTY_LOG');
  await waitFor(() => fs.readFileSync(path.join(workspace, 'logs/ai-sessions/latest.md'), 'utf8').includes('WATCH_LATE_REPLY'));
  assert.equal(cli(workspace, home, ['--watch']).alreadyRunning, true);
  assert.equal(cli(workspace, home, ['--status']).running, true);
  assert.equal(cli(workspace, home, ['--stop']).stopRequested, true);
  await waitFor(() => watcher?.exitCode !== null);
  assert.equal(cli(workspace, home, ['--status']).running, false);
});