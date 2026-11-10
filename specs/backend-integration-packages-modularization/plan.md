# Implementation Plan: Modularize Monolithic Integration Packages (`messenger.package.ts`)

## Overview
Decompose the 773-line `messenger.package.ts` into a modular package architecture while ensuring zero breaking changes to node behavior or registration keys.

---

## Phase 1: Extract Helpers & Cryptographic Utilities

### Tasks
1. Create `monolith-backend/libs/apps/src/messenger/utils/signature-validator.ts`:
   - Move `isValidMetaSignature` and timing-safe equal check.
2. Create `monolith-backend/libs/apps/src/messenger/utils/messenger-helpers.ts`:
   - Move `appOf`, `appTokenOf`, `pagesOf`, `stringList`, and `hasAll`.
3. Add unit tests for signature validator with valid, invalid, and tampered HMAC fixtures.

---

## Phase 2: Extract Credentials & Webhooks

### Tasks
1. Create `monolith-backend/libs/apps/src/messenger/credentials/messenger.credential.ts`:
   - Move `MESSENGER_CREDENTIAL` and OAuth2 code/long-lived token exchange.
2. Create `monolith-backend/libs/apps/src/messenger/triggers/webhook/messenger-webhook.handler.ts`:
   - Move `handle` and `accepts` logic.
3. Create `monolith-backend/libs/apps/src/messenger/triggers/webhook/messenger-lifecycle.ts`:
   - Move `checkExists`, `create`, `delete` Meta App subscription calls.
4. Create `monolith-backend/libs/apps/src/messenger/triggers/messenger.trigger.ts`:
   - Assemble `messenger.trigger` node.

---

## Phase 3: Extract Action Nodes & Reassemble Package

### Tasks
1. Create action node files under `monolith-backend/libs/apps/src/messenger/actions/`:
   - `send-text.action.ts`
   - `send-buttons.action.ts`
   - `send-quick-replies.action.ts`
   - `sender-actions.action.ts`
2. Refactor `messenger.package.ts`:
   - Reassemble the package from the modular parts.
   - Verify file is reduced to < 50 lines.
3. Run existing Messenger integration tests (`npm test -- messenger`).

