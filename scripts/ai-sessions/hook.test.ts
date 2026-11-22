import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { invokeHook, workspaceFixture } from './test-helpers.ts';

test('AIS-02: an unavailable transcript preserves the already saved conversation', (t) => {
  const workspace = workspaceFixture(t);
  const transcript = path.join(workspace, 'transcript.jsonl');
  fs.writeFileSync(transcript, [
    { type: 'USER_INPUT', content: 'Saved prompt' },
    { type: 'PLANNER_RESPONSE', content: 'Saved response' },
  ].map(record => JSON.stringify(record)).join('\n'));
  invokeHook(workspace, transcript);
  const savedPath = path.join(workspace, 'logs/ai-sessions/session-probe001.md');
  const saved = fs.readFileSync(savedPath, 'utf8');
  assert.match(saved, /Saved prompt/);
  assert.match(saved, /Saved response/);
  invokeHook(workspace, path.join(workspace, 'unavailable.jsonl'));
  assert.equal(fs.readFileSync(savedPath, 'utf8'), saved);
});


test('AIS-01/AIS-05: Antigravity retains typed calls and full sidecar/background results', (t) => {
  const workspace = workspaceFixture(t);
  const system = path.join(workspace, '.system_generated');
  fs.mkdirSync(path.join(system, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(system, 'steps/2'), { recursive: true });
  fs.mkdirSync(path.join(system, 'tasks'), { recursive: true });
  const transcript = path.join(system, 'logs/transcript.jsonl');
  fs.writeFileSync(transcript, '');
  fs.writeFileSync(path.join(system, 'logs/transcript_full.jsonl'), [
    { type: 'USER_INPUT', step_index: 0, content: 'Run the command' },
    { type: 'PLANNER_RESPONSE', step_index: 1, thinking: 'HIDDEN_REASONING', tool_calls: [
      { name: 'run_command', args: { CommandLine: 'SYNTHETIC_COMMAND', WaitMs: 10, Blocking: false } },
    ] },
    { type: 'GENERIC', step_index: 2, content: 'SHORT_NATIVE_OUTPUT', error: 'SYNTHETIC_FAILURE', status: 'ERROR' },
    { type: 'PLANNER_RESPONSE', step_index: 3, content: 'Command finished' },
  ].map(row => JSON.stringify(row)).join('\n'));
  fs.writeFileSync(path.join(system, 'steps/2/output.txt'), 'SIDECAR_FULL_OUTPUT');
  fs.writeFileSync(path.join(system, 'tasks/task-2.log'), 'BACKGROUND_OUTPUT');
  invokeHook(workspace, transcript);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-probe001.md'), 'utf8');
  for (const expected of ['SYNTHETIC_COMMAND', 'SHORT_NATIVE_OUTPUT', 'SIDECAR_FULL_OUTPUT', 'BACKGROUND_OUTPUT', 'SYNTHETIC_FAILURE']) {
    assert.ok(output.includes(expected), expected + ' must be saved');
  }
  assert.match(output, /"WaitMs": 10/);
  assert.match(output, /"Blocking": false/);
  assert.ok(!output.includes('HIDDEN_REASONING'));
});

test('AIS-01/AIS-07: public tool fields survive while credential values are masked', (t) => {
  const workspace = workspaceFixture(t);
  const transcript = path.join(workspace, 'privacy.jsonl');
  fs.writeFileSync(transcript, [
    { type: 'USER_INPUT', content: 'Run a tool safely' },
    { type: 'PLANNER_RESPONSE', thinking: 'HIDDEN_PROVIDER_REASONING', tool_calls: [{
      name: 'run_command', args: {
        command: 'program --password "fixture-only-password" --token fixture-only-token',
        reasoning: 'PUBLIC_TOOL_ARGUMENT', clientSecret: 'fixture-client-secret',
      },
    }] },
    { type: 'GENERIC', content: 'Authorization: Bearer fixture-bearer-token' },
  ].map(row => JSON.stringify(row)).join('\n'));
  invokeHook(workspace, transcript);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-probe001.md'), 'utf8');
  assert.ok(output.includes('PUBLIC_TOOL_ARGUMENT'));
  for (const secret of ['fixture-only-password', 'fixture-only-token', 'fixture-client-secret', 'fixture-bearer-token', 'HIDDEN_PROVIDER_REASONING']) {
    assert.ok(!output.includes(secret), secret);
  }
});

test('AIS-02: an existing blank legacy alias is filled from the readable transcript', (t) => {
  const workspace = workspaceFixture(t);
  const output = path.join(workspace, 'logs/ai-sessions/session-probe001.md');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, '\r\n');
  const transcript = path.join(workspace, 'transcript.jsonl');
  fs.writeFileSync(transcript, JSON.stringify({ type: 'USER_INPUT', content: 'RECOVERED_PROMPT' }) + '\n');
  invokeHook(workspace, transcript);
  assert.ok(fs.readFileSync(output, 'utf8').includes('RECOVERED_PROMPT'));
});