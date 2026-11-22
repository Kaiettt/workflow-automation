import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { cli, document, object, workspaceFixture, writeJSONL } from './test-helpers.ts';

test('AIS-01/AIS-03/AIS-04: Codex captures calls/results once and excludes other workspaces', (t) => {
  const workspace = workspaceFixture(t);
  const home = workspaceFixture(t);
  const native = path.join(home, '.codex/sessions/2026/11/22/rollout-fixture.jsonl');
  writeJSONL(native, [
    { type: 'session_meta', payload: { id: 'codex0001', cwd: workspace } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'CODEX_PROMPT' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'CODEX_PROMPT' }] } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: '{"cmd":"CODEX_COMMAND"}', call_id: 'call-1' } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call-1', output: [{ type: 'input_text', text: 'CODEX_RESULT' }] } },
    { type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', input: 'CODEX_PATCH_INPUT', call_id: 'call-2' } },
    { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'call-2', output: 'CODEX_PATCH_RESULT' } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', phase: 'final_answer', content: [{ type: 'output_text', text: 'CODEX_REPLY' }] } },
    { type: 'event_msg', payload: { type: 'agent_message', message: 'CODEX_REPLY', phase: 'final_answer' } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'CODEX_PROMPT' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'CODEX_PROMPT' }] } },
    { type: 'response_item', payload: { type: 'reasoning', summary: 'HIDDEN_CODEX_REASONING' } },
  ]);
  writeJSONL(path.join(path.dirname(native), 'rollout-foreign.jsonl'), [
    { type: 'session_meta', payload: { id: 'foreign001', cwd: path.join(home, 'other-project') } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'FOREIGN_PROMPT' } },
  ]);
  const report = cli(workspace, home);
  assert.equal(report.sessions, 1);
  const saved = document(workspace, 'session-codex-codex0001.json');
  const events = saved.events.filter(object);
  assert.equal(events.filter(event => event.kind === 'user').length, 2);
  assert.equal(events.filter(event => event.kind === 'assistant').length, 1);
  assert.equal(events.filter(event => event.kind === 'tool_call').length, 2);
  assert.equal(events.filter(event => event.kind === 'tool_result').length, 2);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-codex-codex0001.md'), 'utf8');
  for (const expected of ['CODEX_COMMAND', 'CODEX_RESULT', 'CODEX_PATCH_INPUT', 'CODEX_PATCH_RESULT', 'call-1', 'call-2']) assert.ok(output.includes(expected));
  assert.ok(!output.includes('HIDDEN_CODEX_REASONING'));
  assert.ok(!fs.existsSync(path.join(workspace, 'logs/ai-sessions/session-codex-foreign001.json')));
  cli(workspace, home);
  assert.equal(document(workspace, 'session-codex-codex0001.json').events.length, 7);
});

test('AIS-01/AIS-05/AIS-07: Claude retains canonical tools, richer output and image attachments', (t) => {
  const workspace = workspaceFixture(t);
  const home = workspaceFixture(t);
  const project = workspace.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const native = path.join(home, '.claude/projects', project, 'claude0001.jsonl');
  const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=';
  const tool = { type: 'tool_use', id: 'claude-call-001', name: 'Bash', input: { command: 'CLAUDE_COMMAND', api_key: 'fake-credential-only-for-test' } };
  writeJSONL(native, [
    { type: 'user', cwd: workspace, sessionId: 'claude0001', uuid: 'u1', message: { content: 'CLAUDE_PROMPT' } },
    { type: 'assistant', cwd: workspace, sessionId: 'claude0001', uuid: 'a1', message: { content: [
      { type: 'thinking', thinking: 'HIDDEN_CLAUDE_REASONING' }, tool,
    ] } },
    { type: 'api-request-blob', cwd: workspace, sessionId: 'claude0001', message: { content: [tool] } },
    { type: 'user', cwd: workspace, sessionId: 'claude0001', uuid: 'u2', message: { content: [
      { type: 'tool_result', tool_use_id: 'claude-call-001', is_error: true, content: [
        { type: 'text', text: 'CLAUDE_NATIVE_RESULT' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } },
      ] },
    ] }, toolUseResult: { stdout: 'CLAUDE_FULL_STDOUT', stderr: 'CLAUDE_FULL_STDERR', interrupted: true } },
    { type: 'assistant', cwd: workspace, sessionId: 'claude0001', uuid: 'a2', message: { content: [{ type: 'text', text: 'CLAUDE_REPLY' }] } },
  ]);
  assert.equal(cli(workspace, home).sessions, 1);
  const saved = document(workspace, 'session-claude-claude0001.json');
  const events = saved.events.filter(object);
  assert.equal(events.filter(event => event.kind === 'tool_call').length, 1);
  assert.equal(events.filter(event => event.kind === 'tool_result').length, 1);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-claude-claude0001.md'), 'utf8');
  for (const expected of ['CLAUDE_PROMPT', 'CLAUDE_REPLY', 'CLAUDE_COMMAND', 'CLAUDE_NATIVE_RESULT', 'CLAUDE_FULL_STDOUT', 'CLAUDE_FULL_STDERR', 'claude-call-001']) assert.ok(output.includes(expected));
  assert.ok(!output.includes('HIDDEN_CLAUDE_REASONING'));
  assert.ok(!output.includes('fake-credential-only-for-test'));
  assert.ok(!output.includes(image));
  const assets = fs.readdirSync(path.join(workspace, 'logs/ai-sessions/assets'));
  assert.equal(assets.filter(name => name.endsWith('.png')).length, 1);
  const bytes = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/assets', assets[0]));
  assert.ok(bytes.equals(Buffer.from(image, 'base64')));
});

test('AIS-01/AIS-07: Cursor exported sections and explicit source binding are retained', (t) => {
  const workspace = workspaceFixture(t);
  const home = workspaceFixture(t);
  const native = path.join(home, 'cursor0001.txt');
  fs.writeFileSync(native, [
    'user:', '<user_query>CURSOR_PROMPT</user_query>', 'assistant:',
    '[Tool call] run_terminal_cmd', '{"command":"CURSOR_COMMAND","timeout":10}',
    '[Tool result]', 'CURSOR_RESULT', '[Tool call] mcp_tool', '{}',
    '[Tool result]', 'assistant:', 'CURSOR_REPLY',
  ].join('\n'));
  const report = cli(workspace, home, ['--source', native, '--provider', 'cursor', '--session', 'cursor0001']);
  assert.equal(report.sessions, 1);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-cursor-cursor0001.md'), 'utf8');
  for (const expected of ['CURSOR_PROMPT', 'CURSOR_REPLY', 'CURSOR_COMMAND', 'CURSOR_RESULT']) assert.ok(output.includes(expected));
  assert.match(output, /Native tool result.*unavailable/i);
  assert.equal(cli(workspace, home).sessions, 1);
});

test('AIS-04: Antigravity metadata binds unseen repo sessions without reading prompt paths', (t) => {
  const workspace = workspaceFixture(t);
  const home = workspaceFixture(t);
  const databaseFile = path.join(home, '.gemini/antigravity/conversation_summaries.db');
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const database = new DatabaseSync(databaseFile);
  database.exec('CREATE TABLE conversation_summaries (conversation_id TEXT, workspace_uris TEXT, app_data_dir TEXT)');
  const insert = database.prepare('INSERT INTO conversation_summaries VALUES (?, ?, ?)');
  insert.run('agy-db001', JSON.stringify([pathToFileURL(workspace).href]), 'antigravity');
  insert.run('agy-other', JSON.stringify([pathToFileURL(home).href]), 'antigravity');
  database.close();
  const original = fs.readFileSync(databaseFile);
  writeJSONL(path.join(home, '.gemini/antigravity-ide/brain/agy-db001/.system_generated/logs/transcript_full.jsonl'), [
    { type: 'USER_INPUT', content: 'METADATA_BOUND_PROMPT' },
    { type: 'PLANNER_RESPONSE', content: 'METADATA_BOUND_REPLY' },
  ]);
  writeJSONL(path.join(home, '.gemini/antigravity/brain/agy-other/.system_generated/logs/transcript_full.jsonl'), [
    { type: 'USER_INPUT', content: 'FOREIGN_PROMPT' },
  ]);
  assert.equal(cli(workspace, home).sessions, 1);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-antigravity-agy-db001.md'), 'utf8');
  assert.ok(output.includes('METADATA_BOUND_PROMPT') && output.includes('METADATA_BOUND_REPLY'));
  assert.ok(!fs.existsSync(path.join(workspace, 'logs/ai-sessions/session-antigravity-agy-other.md')));
  assert.ok(fs.readFileSync(databaseFile).equals(original));
  assert.ok(!fs.readdirSync(path.join(workspace, 'logs/ai-sessions/.state')).some(name => name.startsWith('native-binding-')));
});

test('AIS-02/AIS-05: a shorter valid Claude snapshot retains prior structured result data', (t) => {
  const workspace = workspaceFixture(t);
  const home = workspaceFixture(t);
  const native = path.join(home, 'partial-claude.jsonl');
  const prompt = { type: 'user', cwd: workspace, sessionId: 'partial001', uuid: 'p1', message: { content: 'PARTIAL_PROMPT' } };
  writeJSONL(native, [prompt, {
    type: 'user', cwd: workspace, sessionId: 'partial001', uuid: 'r1',
    message: { content: [{ type: 'tool_result', tool_use_id: 'partial-call', content: [
      { type: 'text', text: 'COMPLETE_RESULT' }, { type: 'tool_reference', tool_name: 'PRESERVED_REFERENCE' },
    ] }] }, toolUseResult: { stdout: 'COMPLETE_STDOUT' },
  }]);
  cli(workspace, home, ['--source', native, '--provider', 'claude', '--session', 'partial001']);
  writeJSONL(native, [prompt, {
    type: 'user', cwd: workspace, sessionId: 'partial001', uuid: 'r1',
    message: { content: [{ type: 'tool_result', tool_use_id: 'partial-call', content: [{ type: 'text', text: 'C' }] }] },
  }]);
  cli(workspace, home);
  const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions/session-claude-partial001.md'), 'utf8');
  for (const expected of ['COMPLETE_RESULT', 'COMPLETE_STDOUT', 'PRESERVED_REFERENCE']) assert.ok(output.includes(expected), expected);
});