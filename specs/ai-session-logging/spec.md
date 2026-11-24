# AI session logging

Approved on 2026-11-22 after the user chose repo-only collection and full visible
activity, then explicitly confirmed implementation.

## Acceptance criteria and Given/When/Then scenarios

- AIS-01: Given a supported workspace session, when collected, then Markdown and
  structured events preserve prompts, visible responses, typed tool inputs and
  available results, identified by client and full session ID.
- AIS-02: Given saved events, when a transcript is unavailable, empty, unreadable
  or incomplete, then collection preserves saved events and reports a warning.
- AIS-03: Given repeated collection, overlapping native streams, concurrent
  clients or matching short IDs, when saved, then events are deduplicated and
  distinct sessions cannot overwrite one another. Preserve latest.md and existing
  Antigravity session aliases.
- AIS-04: Given native histories for multiple projects, when sources are scanned,
  then only sessions associated with this workspace are imported.
- AIS-05: Given failed tools, attachments, sidecars and background command output,
  when collected again, then failures and newly available output are retained
  with native call IDs or step indexes where available.
- AIS-06: Given Windows sign-in or repeated starts, when automatic collection
  runs, then one hidden collector updates logs and exposes collect/start/stop/status
  commands without replacing existing client integrations.
- AIS-07: Given credentials or unavailable/abbreviated output, when persisted,
  then credentials are masked, hidden reasoning is omitted, and missing native
  data is identified honestly.
- AIS-08: Given a stale ownership file whose PID now belongs to an unrelated
  live process, when status/start/stop runs, then the process is not treated as
  the collector, a new collector can claim the workspace, logs resume and the
  unrelated process is never stopped. Verify PID, command/workspace and process
  creation identity rather than PID existence alone.

Support Antigravity, Codex, Claude Code and Cursor through verified hooks or
readable native transcripts. Closed apps/websites need an export integration.
Collection cannot recover output the originating client did not expose.

## Public verification seams

Verify hook/collector invocations and their output files with synthetic native
transcripts in temporary workspaces. Verify Windows lifecycle commands and script
syntax. Local-source smoke checks report counts without exposing messages.
