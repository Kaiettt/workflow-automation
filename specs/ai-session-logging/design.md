# Design

Extend the existing hook entry point and keep collection outside application
modules. Shared TypeScript modules handle native transcript parsing, discovery
and atomic persistence. CommonJS CLI/hook entry points run on the installed
Node 24 runtime; no new package dependency or external service is required.

Persist versioned session JSON alongside readable Markdown. Event identities use
native row/call/step identifiers; merge snapshots without removing previously
saved events. Serialize store updates across hooks and the collector. Keep
canonical names scoped by provider/full ID and preserve compatible aliases.

Antigravity hook contexts bind transcripts to the workspace. Prefer full native
transcripts and include output.txt and background task logs. Seed historical
bindings from existing session-log metadata. Preserve step order without
inventing parallel-call correlation IDs.

Codex discovery filters session_meta.payload.cwd, avoids duplicated visible
message streams and correlates tool results by call_id. Preserve existing notify.
Claude consumes canonical user/assistant rows, excludes repeated request blobs,
and retains tool result IDs, richer toolUseResult data and attachments.
Cursor consumes this workspace's exported native transcript directory when
available, with explicit warnings for absent/abbreviated results.

A hidden Windows collector polls changed sources and starts at user sign-in.
Provide installation/start/stop/status/collect-once commands and local diagnostics.
Mask credentials before persistence and omit hidden reasoning. New runtime data
stays local; existing tracked logs are preserved.

Public verification seams are hook/collector invocations, output files and
Windows lifecycle commands, as recorded in spec.md.


Verified implementation: shared modules live in scripts/ai-sessions. Native
Antigravity conversation_summaries metadata exposes JSON workspace_uris arrays;
read a temporary SQLite/WAL snapshot and query only conversation/workspace IDs.
This enables exact repo-only discovery before legacy Stop logging. Search both
modern and IDE brain roots for matched IDs. Keep original databases untouched.
Background polling caches changed transcript/sidecar signatures. It repairs
latest.md from the durable canonical Markdown if a legacy writer replaces it.
User-level scheduled-task installation is prepared but currently blocked by
automatic escalation-review failure; the current hidden collector is running.