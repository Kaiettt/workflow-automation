# Checklist: Quản lý Loại Node

Status: implemented (P1). User authorized implementation on 2026-11-22.

## Feature tasks

- [x] G5.1 Database: NodeTypePolicy model, catalog relation, additive migration with defaults/FK/nonnegative revision. Prisma generation/validation and real isolated migration deployment succeeded.
- [x] G5.2 Catalog sync protection: retained the existing metadata-only sync. Real repeated-sync tests prove policies/revisions remain unchanged; no unnecessary production sync rewrite.
- [x] G5.3 Policy port/command: domain validation and transition planning, advisory lock 7261103, partial updates, optimistic revision, no-op and atomic NODE_TYPE_STATUS_CHANGED audit using the definition UUID.
- [x] G5.4 Palette/metadata: visibility filtering plus authenticated bounded metadata-by-key retrieval. Existing runtime/publish schema retrieval remains unfiltered.
- [x] G5.5 Runtime gate: production DI supplies the policy port; disabled nodes never call the executor, log FAILED/NODE_TYPE_DISABLED and terminate the workflow. Legacy construction remains compatible.
- [x] G5.6 Admin projection/HTTP: search/category/connector/policy filters, stable server sorting/pagination, distinct JSONB usage against current published and DRAFT definitions, safe bounded detail, strict mutations and Admin-only access.
- [x] G5.7 Frontend: /admin/node-types route/menu, accessible filters/table/details/status dialog, query invalidation, conflict reload/retry, preserved reasons, shared icon renderer and Designer metadata compatibility.
- [x] G5.8 Scenario verification: automated coverage of BDD-NM-01 through BDD-NM-10 across real HTTP/PostgreSQL, domain/runtime and frontend user interactions.

## BDD/TDD evidence

Commands below are relative to monolith-backend unless a frontend path is stated.

| Slice / scenarios | Test layer and command | Observed Red | Observed Green |
|---|---|---|---|
| Runtime error / BDD-NM-03 | jest --runInBand --runTestsByPath test/unit/execution/application/node-type-error-code.spec.ts | Disabled code became UNCLASSIFIED_ERROR | Platform allowlist preserves NODE_TYPE_DISABLED and rejects arbitrary codes |
| Policy transitions / BDD-NM-05/06/07 | jest --runInBand --runTestsByPath test/unit/node-library/node-type-policy.spec.ts | Visibility/revision unchanged; stale update did not throw | Partial update, stale/no-op rules pass |
| Input / BDD-NM-09 | Same domain suite, followed by HTTP suite | Missing flags and invalid reason accepted | Validation and HTTP rejection pass |
| Runtime / BDD-NM-03 | jest --runInBand --runTestsByPath test/unit/execution/application/node-type-runtime-policy.spec.ts | After correcting test graph setup, executor was called despite disabled policy | Executor untouched, typed failed log, FAILED engine result |
| Admin HTTP / BDD-NM-09 | jest --runInBand --runTestsByPath test/unit/admin/admin-node-types.spec.ts | Endpoint returned 404 | Admin succeeds; Client/anonymous/invalid input rejected; conflict mapped |
| Metadata / BDD-NM-02 | jest --runInBand --runTestsByPath test/unit/node-library/node-metadata-http.spec.ts | Endpoint returned 404 | Authenticated metadata and key bounds pass |
| Designer / BDD-NM-02 | frontend: vitest run src/features/workflow/components/node-policy-compatibility.test.tsx --environment jsdom --maxWorkers=2 | Hidden Switch appeared in Sidebar | Hidden palette item absent, existing config editable |
| Status dialog / BDD-NM-10 | frontend: vitest run src/features/admin/components/node-types/NodeTypeStatusDialog.test.tsx --environment jsdom --maxWorkers=2 | Required switch missing | Reason/revision/both flags and conflict reload/retry pass |
| Admin page / BDD-NM-01 | frontend: vitest run src/features/admin/pages/NodeTypesPage.test.tsx --environment jsdom --maxWorkers=2 | Page heading missing | Usage and server category filters pass |
| Initial Designer hydration regression / BDD-NM-02 | frontend: vitest run src/features/workflow/pages/DesignerPage.test.tsx src/features/workflow/hooks/useDesignerNodeCatalog.test.tsx --environment jsdom --maxWorkers=2 | Existing Publish tests lost the click during transient metadata loading | Initial draft seeds metadata before canvas render; all 5 tests pass |

The first direct DATABASE_URL TCP probe returned ECONNREFUSED. The integration harness uses TEST_DATABASE_URL when supplied, falling back to DATABASE_URL; it successfully created, migrated and removed isolated test databases. There was no observed transaction-layer Red run before implementing the adapter; atomicity/concurrency are independently verified by real PostgreSQL integration tests, not claimed as a completed transaction-layer TDD cycle.

## Final validation

- Backend full unit suite: node node_modules/jest/bin/jest.js --runInBand — 45 suites, 574 tests passed.
- Backend full integration suite: node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand — 2 suites, 24 tests passed before the extra filtering/draft-save scenario was added.
- Final G5 integration suite: same config with --runTestsByPath test/integration/admin/node-types.integration-spec.ts — 6 tests passed. Includes real JWT, additive migration, distinct usage/history/archive exclusion, filters/sorting, no-op, concurrent updates, audit rollback, hidden-node draft GET/PUT and execution, disabled runtime logs and repeated catalog sync.
- Final relevant backend verification after lint fixes: 8 suites, 41 tests passed (Admin/catalog HTTP, policy decisions, runtime/observer, mapper).
- Frontend full suite: npm test — 53 suites, 171 tests passed.
- Backend lint: npm run lint -- --no-fix --quiet — passed. Initial direct invocation hit Node's default heap limit; the repository script's 4096 MB setting completed successfully. The build's normal prebuild lint also passed.
- Frontend lint: npm run lint, and prebuild lint — passed.
- Backend source type-check: node node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false — passed.
- Frontend type-check: node node_modules/typescript/bin/tsc -b --pretty false and npm run build — passed.
- Backend build: npm run build — webpack compiled successfully.
- Frontend build: npm run build — passed, with the existing application bundle-size warning (>500 kB).
- Prisma: generate and validate — passed. Formatter was run, then unrelated formatting changes were removed while retaining the identical valid policy model.
- git diff --check — passed.

## Known limitations and rollout

Full backend tsc --noEmit --incremental false still reports 7 errors in unchanged existing test fixtures: admin-connectors.spec.ts (missing name); workflow-validation.util.spec.ts (overly broad object); node-config-resolver.spec.ts (null credential, two extraneous id fields, missing executeItem); node-execution-observer.spec.ts (string instead of array-valued name index). No feature/source type errors remain. These fixtures are outside the G5 production change and were not rewritten.

Local development migrations were applied on 2026-11-22 after the reported missing-table errors; see the operational verification below. Production deployment remains subject to the normal deployment workflow. Runtime blocking applies at node start and does not cancel calls already executing. Client palette refresh is on focus/foreground polling; immediate enforcement is at runtime.


## Local database repair — 2026-11-22

The running development backend reported P2021 for connector_policies and P2010/42P01 for node_type_policies. prisma migrate status confirmed exactly two pending additive migrations on the configured local flowpilot/public database.

- Read-only reproduction: from monolith-backend, node -r ts-node/register/transpile-only -r tsconfig-paths/register ../.scratch/diagnostics/g5/check-policy-schema.cjs. The real PrismaAdminRead.connectors/nodeTypes queries failed with P2021/P2010 before repair and both passed afterwards.
- Applied node node_modules/prisma/build/index.js migrate deploy: 20261116000000_admin_connector_policy and 20261122000000_node_type_policy both completed successfully.
- Follow-up migrate status: Database schema is up to date.
- Verified existing user/workflow/version/credential/execution counts were unchanged.
- Verified the already-running backend returned HTTP 200 for /api/node-types and authenticated /api/admin/connectors and /api/admin/node-types. No server restart was required.
- No production behavior/code changed for this operational repair, so lint/type-check/build and the feature regression suites were not repeated. Prior executed evidence above remains applicable. The local read-only diagnostic is retained under .scratch/diagnostics/g5.
