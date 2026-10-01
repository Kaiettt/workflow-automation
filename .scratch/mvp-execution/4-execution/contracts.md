# Execution contracts (designer-published graphs)

Authoritative for phase 4. Tickets 4.1–4.4 implement this; they do not redefine it.

## Manual trigger

The only MVP start is **`POST /api/executions`** with `{ "workflow_version_id": "<uuid>" }`. The HTTP request is synchronous: it returns after traversal finishes, with the persisted `executions` row and node logs. `trigger_type` is `MANUAL`. Authorize that the caller may run that version’s workflow.

## Load the graph from `workflow_versions`

Read `workflow_versions.definition` (React Flow `{ nodes, edges, viewport }`). Live shape: `definition.json` / `data-now.md`.

- Catalog type is **`node.data.key`** (`trigger.manual`, `integration.google_sheet.readRows`, `logic.filter`, `integration.gmail.send`).
- React Flow **`node.type`** is only UI (`triggerNode` / `actionNode`). Do not dispatch on it.
- Log `execution_node_logs.node_id` = instance `id`, `node_key` = `data.key`.

Intended order: **manual trigger → Google Sheets → filter → Gmail**.

## Walk a linear path

Do not infer a start node from `trigger.manual`. Do not reverse or treat edges as undirected. Later tickets will mark the entry point and correct designer direction.

Visit order is the `edges` array, in index order, as a directed chain:

- First node is `edges[0].source`.
- Then each `edges[i].target` in order.
- Require `edges[i].source === edges[i - 1].target`. Empty `edges` or a broken chain fails the run. Branching is out of scope.

The published definition must already store that chain in run order (edit `workflow_versions.definition` in the database until the designer writes it). Fixture visit order for `definition.json`: `triggerNode-1790495263533` → `actionNode-1790495266935` → `actionNode-1790495268781` → `actionNode-1790495269694`.

## Credentials

Tokens are **not** in the definition. Nodes store `data.config.credential_id`. Load `connector_credentials` by that id (UUID), verify `owner_id` and Google `connector_id`, decrypt `encrypted_secret` in memory with `EncryptionUtil`, pass plaintext only into the integration handler.

Do not write tokens, `encrypted_secret`, or the encryption key into logs, context, or API bodies.

The current designer writes the placeholder `"google-credential"` (see `definition.json`). That string is not a row id. Real rows in `data-now.md` are UUIDs (two OAuth clicks produced two rows). Until the designer stores the UUID, 4.3 lookup fails on this fixture. Engine still implements UUID lookup.

## Node executor interface

One runtime contract for every catalog key. Name it **`INodeExecutor`** (`I` prefix is allowed for node/connector plugins). The engine never `switch`es on `data.key`; it looks up the registered implementation.

```typescript
interface INodeExecutor<TConfig = unknown, TInput = unknown, TOutput = unknown> {
  readonly key: string;
  execute(params: {
    config: TConfig;
    input: TInput | null;
    credential: unknown | null;
  }): Promise<TOutput | null>;
}
```

- `key` is the catalog string (`node.data.key`).
- `config` / `input` are already parsed to that implementation’s models. Skip parse when the schema is null; pass `{}` or `null` as specified in the table below.
- `credential` is null unless the node uses Google OAuth. The engine resolves and decrypts it; executors must not load `connector_credentials` themselves.
- Return `null` when the output schema is null. The engine still writes a node log (Gmail may put send counts on the log `output` field without changing this return type).

Register every implementation in a map `key → INodeExecutor`. Unknown `data.key` fails that node. File names kebab-case; class names PascalCase; one class per key.

| `data.key` | class | ticket |
|---|---|---|
| `trigger.manual` | `ManualTriggerExecutor` | 4.1 stub, 4.2 real no-op |
| `integration.google_sheet.readRows` | `GoogleSheetReadRowsExecutor` | 4.1 stub, 4.3 real |
| `logic.filter` | `FilterExecutor` | 4.1 stub, 4.2 real |
| `integration.gmail.send` | `GmailSendExecutor` | 4.1 stub, 4.3 real |

## Handler-owned schemas

Each executor declares TypeScript models for config / input / output. A schema may be **null** (no parse, no payload). Catalog JSON in `node_type_definitions` is not the runtime parser.

| `data.key` | config | input | output |
|---|---|---|---|
| `trigger.manual` | null (`{}`) | null | null (empty context) |
| `integration.google_sheet.readRows` | `credential_id`, `spreadsheet_id`, `sheet_name` | null | array of row objects |
| `logic.filter` | `field`, `operator` (`equals` \| `not_equals` \| `contains`), `value` | row array | filtered row array |
| `integration.gmail.send` | `credential_id`, `subject`, `body` | array of `{ name, email }` | null (log aggregate send counts on the node log without an output schema) |

Gmail has no config `to`. Recipients come from the input array: one send per item, using that item’s `email`. `subject` / `body` support `{{variable}}` from each item (`{{name}}`, `{{email}}`). Input parse fails if an item is missing `name` or `email`.

## Persistence

Create `executions` (`RUNNING` then `SUCCESS` or `FAILED`) with workflow id, version id, `MANUAL`, actor, timestamps, duration. One `execution_node_logs` row per visited node. Stop the chain on first node failure; remaining nodes are not executed. 4.1 may write mock I/O; 4.2+ write real executor I/O (still redacting secrets).
