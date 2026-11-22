# Tasks and validation evidence

User approved implementation on 2026-11-22: repo-only prompts, responses,
commands/tool calls and available results.

- [x] Inspect original logger, standards/workflow, native schemas and test seams.
- [x] Approve spec/design/plan and implement shared native-source collection.
- [x] AIS-01/03/04/05/07: support Antigravity, Codex, Claude and exported Cursor text.
- [x] AIS-02: preserve absent/shortened exports and recover blank legacy aliases.
- [x] AIS-06: verify singleton watch, late output, stop/status and latest repair.
- [x] Install repo Claude PostToolUse/Stop hooks without changing existing hooks.
- [x] Start hidden collector for the current Windows session.
- [x] Import actual workspace history: smoke check observed 20 canonical sessions
  and more than 6,400 events; Cursor currently has no repo transcript.
- [x] Run tooling lint, strict type checking, tests and build.
- [ ] Update protected Antigravity hook/script through setup.ps1.
- [ ] Register Windows sign-in task through setup.ps1.
- [ ] Verify persistent sign-in startup after the blocked setup step succeeds.

## Red/Green evidence

Public seams: hook/collector commands and their files in temporary workspaces,
native SQLite metadata fixtures, and watcher lifecycle commands.

Each slice was executed Red before its production change:
- Missing transcript: old hook overwrote one saved turn with zero turns.
- Antigravity full events: tool command absent before call/result/sidecar parsing.
- Codex: no session imported before native parser; dedup/workspace controls passed.
- Claude: no session imported before canonical blocks/richer outputs/image parsing.
- Cursor: no imported session before exported section parser and explicit binding.
- Metadata binding: unseen Antigravity session not imported before SQLite binding.
- Short valid export: prior complete stdout disappeared before monotonic data merge.
- Public tool fields: reasoning-named argument missing before provider-only omission.
- Blank legacy alias: remained blank before blank-file recovery.
- Watcher: exited after first import before watch/lifecycle implementation.
- Latest repair: cached watcher left a legacy overwrite unchanged before repair.

Green: npm run test:ai-sessions executed 10 tests, all passed, with no skipped tests.
npm run lint:ai-sessions, npm run typecheck:ai-sessions and npm run build:ai-sessions
each exited 0. Build emitted runnable JavaScript and compiled CLI help succeeded.
PowerShell syntax parsing passed for manage.ps1, install-hooks.ps1 and setup.ps1.
Real -Start and -Status commands verified hidden collector ownership/running state.

Frontend/backend app checks were not run: application modules/contracts are untouched.
Checks above cover the changed scripting/tooling projects.

## Setup blocker

Automatic escalation approval review failed with content-blocked before executing
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-sessions/setup.ps1.
This was a review infrastructure failure, not an unsafe-action determination.
The protected Antigravity files remain unchanged and no sign-in task was registered.
Current collection works independently via native files and verified metadata;
it repairs legacy latest output. One manual setup command remains in README.md.

## Limits

Only output actually exported by clients can be collected. Cursor workspace-folder
encoding for spaces was not independently verified; explicit --source registration
supports exports at a different location. Native Antigravity result association
retains real step order because flattened tool records expose no call IDs.