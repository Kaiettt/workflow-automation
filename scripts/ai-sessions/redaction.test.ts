import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { markdown, saveSession } from './store.ts';
import type { Session } from './types.ts';
import { document, object, workspaceFixture } from './test-helpers.ts';

const fixtureValue = '0123456789abcdef'.repeat(4);

function sessionFixture(workspace: string): Session {
  return {
    version: 1, provider: 'antigravity', sessionId: 'encryption-session', workspace,
    model: 'fixture', modifiedAt: '2026-11-25T00:00:00Z',
    events: [{ id: 'key-event', kind: 'tool_result', timestamp: '2026-11-25T00:00:00Z', content: 'VISIBLE_OUTPUT' }],
    sources: [], warnings: [],
  };
}

function seedSession(session: Session): void {
  const output = path.join(session.workspace, 'logs/ai-sessions');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'session-antigravity-encryption-session.json'), JSON.stringify(session, null, 2) + '\n');
  for (const name of ['session-antigravity-encryption-session.md', 'session-encrypti.md']) {
    fs.writeFileSync(path.join(output, name), markdown(session));
  }
}

function assertKeyHidden(workspace: string): void {
  for (const name of ['session-antigravity-encryption-session.json', 'session-antigravity-encryption-session.md', 'session-encrypti.md', 'latest.md']) {
    const output = fs.readFileSync(path.join(workspace, 'logs/ai-sessions', name), 'utf8');
    assert.ok(!output.includes(fixtureValue), 'Encryption key must be masked in ' + name);
    assert.ok(output.includes('<REDACTED>'), 'Redaction marker must be present in ' + name);
  }
}

test('AIS-07: masks encryption keys in tool output and nested structured fields', (t) => {
  const workspace = workspaceFixture(t);
  const session = sessionFixture(workspace);
  session.events[0].content = 'VISIBLE_OUTPUT\n29:ENCRYPTION_KEY=' + fixtureValue + '\nprogram --encryption-key ' + fixtureValue;
  session.events[0].data = { input: { encryptionKey: fixtureValue, ENCRYPTION_KEY: fixtureValue, workflowName: 'Visible workflow' } };
  saveSession(session);
  assertKeyHidden(workspace);
  const saved = document(workspace, 'session-antigravity-encryption-session.json');
  assert.equal(saved.events.length, 1);
  assert.ok(object(saved.events[0]));
  assert.deepEqual(saved.events[0].data, { input: { encryptionKey: '<REDACTED>', ENCRYPTION_KEY: '<REDACTED>', workflowName: 'Visible workflow' } });
  assert.match(String(saved.events[0].content), /VISIBLE_OUTPUT/);
});

test('AIS-02/AIS-07: masks a saved encryption key while preserving longer historical output', (t) => {
  const workspace = workspaceFixture(t);
  const session = sessionFixture(workspace);
  session.events[0].content = 'VISIBLE_OLD_OUTPUT\nENCRYPTION_KEY=' + fixtureValue + '\nKEEP_HISTORY';
  seedSession(session);
  session.events[0].content = 'SHORT_OUTPUT';
  assert.equal(saveSession(session).changed, true);
  assertKeyHidden(workspace);
  const saved = document(workspace, 'session-antigravity-encryption-session.json');
  assert.equal(saved.events.length, 1);
  assert.ok(object(saved.events[0]));
  assert.equal(saved.events[0].content, 'VISIBLE_OLD_OUTPUT\nENCRYPTION_KEY=<REDACTED>\nKEEP_HISTORY');
  assert.equal(saveSession(session).changed, false);
});

test('AIS-07: rewrites saved JSON when only a structured encryption key needs masking', (t) => {
  const workspace = workspaceFixture(t);
  const session = sessionFixture(workspace);
  session.events[0].data = { encryptionKey: fixtureValue, workflowName: 'Visible workflow' };
  seedSession(session);
  session.events[0].data = { encryptionKey: '<REDACTED>', workflowName: 'Visible workflow' };
  assert.equal(saveSession(session).changed, true);
  assertKeyHidden(workspace);
  const saved = document(workspace, 'session-antigravity-encryption-session.json');
  assert.ok(object(saved.events[0]));
  assert.deepEqual(saved.events[0].data, { encryptionKey: '<REDACTED>', workflowName: 'Visible workflow' });
  assert.equal(saveSession(session).changed, false);
});

test('AIS-07: repairs Markdown copies even when the saved JSON is already masked', (t) => {
  const workspace = workspaceFixture(t);
  const session = sessionFixture(workspace);
  session.events[0].data = { encryptionKey: '<REDACTED>' };
  saveSession(session);
  const output = path.join(workspace, 'logs/ai-sessions');
  const corruptedSession: Session = { ...session, events: [{ ...session.events[0], data: { encryptionKey: fixtureValue } }] };
  for (const name of ['session-antigravity-encryption-session.md', 'session-encrypti.md']) {
    fs.writeFileSync(path.join(output, name), markdown(corruptedSession));
  }
  assert.equal(saveSession(session).changed, false);
  assertKeyHidden(workspace);
});
