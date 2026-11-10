# Refactoring Specification: Modularize Monolithic Integration Packages (`messenger.package.ts`)

> **Category:** Backend Architecture & Integration Extensibility  
> **Status:** Proposed  
> **Target Scope:** `monolith-backend/libs/apps/src/messenger/` and `monolith-backend/libs/apps/src/http/`

---

## 1. Problem Statement & Motivation

Integration packages in `monolith-backend/libs/apps/` connect external SaaS tools and protocols to FlowPilot workflows. However, the Facebook Messenger integration has been authored as a single monolithic **773-line file** (`messenger.package.ts`, 25.4 KB).

Inside `messenger.package.ts`:
1. **Mega-Factory Function:** A single function `createMessengerPackage(graph: MetaGraphApi)` spans hundreds of lines.
2. **Mixed Domain Concepts:**
   - Credential definitions and OAuth2 code/long-lived token exchange.
   - Dynamic page option loader queries.
   - HMAC-SHA256 signature verification (`isValidMetaSignature`).
   - Webhook lifecycle management (`checkExists`, `create`, `delete`, `handle`, `accepts`).
   - 5 distinct action node definitions:
     - `messenger.send_text`
     - `messenger.send_buttons`
     - `messenger.send_quick_replies`
     - `messenger.typing_indicator`
     - `messenger.mark_seen`
   - 1 trigger node definition (`messenger.trigger`).
   - Private formatting helpers (`appOf`, `appTokenOf`, `pagesOf`, `stringList`, etc.).
3. **High Blast Radius & Poor Readability:**
   - Any modification or bug fix to a single action (e.g., adding a new button type to `messenger.send_buttons`) requires modifying this 773-line file, increasing merge conflict risks.
   - Adding new Messenger features (e.g., Generic Template carousel, Audio/Image send) further bloats this already oversized file.
   - Similar bloat exists in `http.package.ts` (12.7 KB).

---

## 2. Goals & Non-Goals

### Goals
- **Decompose `messenger.package.ts`** into a clear, feature-grouped directory structure following the Single Responsibility Principle.
- **Isolate Webhook Lifecycle & Signature Validation** into dedicated testable modules.
- **Separate each Action and Trigger node** into its own declarative file (< 100 lines each).
- **Preserve 100% API and runtime contract compatibility**: node keys, input/output schemas, and package registration must remain unchanged.
- **Establish a repeatable architectural standard** for all present and future integration packages (e.g. Slack, GitHub, Telegram, Google).

### Non-Goals
- Modifying the underlying Meta Graph API client (`meta-graph.api.ts`).
- Changing Messenger webhook subscription endpoints or OAuth permission scopes.

---

## 3. Architecture & Target Directory Structure

```
monolith-backend/libs/apps/src/messenger/
├── index.ts                           # Public exports
├── meta-graph.api.ts                  # Graph API HTTP client (existing)
├── messenger.package.ts               # Top-level integration package assembler (< 50 lines)
├── credentials/
│   └── messenger.credential.ts        # Credential definition & OAuth2 token exchange
├── triggers/
│   ├── messenger.trigger.ts           # Trigger node definition
│   └── webhook/
│       ├── messenger-webhook.handler.ts # Verification, signature check, event parsing
│       └── messenger-lifecycle.ts     # Meta App subscription check, create, delete
├── actions/
│   ├── send-text.action.ts            # messenger.send_text
│   ├── send-buttons.action.ts         # messenger.send_buttons
│   ├── send-quick-replies.action.ts   # messenger.send_quick_replies
│   └── sender-actions.action.ts       # typing_indicator & mark_seen
└── utils/
    ├── signature-validator.ts         # HMAC SHA256 timing-safe comparison
    └── messenger-helpers.ts           # Token/page extraction helpers
```

---

## 4. Detailed Component Specifications

### 4.1 Entry Point: `messenger.package.ts`
The main file becomes a lightweight assembler:

```typescript
export function createMessengerPackage(graph: MetaGraphApi): IntegrationPackage {
  return {
    key: 'messenger',
    displayName: 'Facebook Messenger',
    description: 'Send and receive messages from Facebook Pages',
    icon: 'message-circle',
    color: '#0084FF',
    credentials: [createMessengerCredential(graph)],
    triggers: [createMessengerTrigger(graph)],
    actions: [
      createSendTextAction(graph),
      createSendButtonsAction(graph),
      createSendQuickRepliesAction(graph),
      createTypingIndicatorAction(graph),
      createMarkSeenAction(graph),
    ],
  };
}
```

### 4.2 Webhook Lifecycle & Security (`triggers/webhook/`)
- `signature-validator.ts`: Pure cryptographic utility using `node:crypto` (`createHmac`, `timingSafeEqual`). Easily tested with mock signatures and fixtures.
- `messenger-webhook.handler.ts`: Handles Meta's `hub.challenge` handshake on `GET` and dispatches authenticated webhook events on `POST`.
- `messenger-lifecycle.ts`: Handles Meta App & Page subscriptions when workflows activate or deactivate.

### 4.3 Action Nodes (`actions/`)
Each action file exports a factory accepting `MetaGraphApi` and returns an `ActionNode`:
- `send-text.action.ts`: Defines `recipient_id`, `text`, properties and the execution handler.
- `send-buttons.action.ts`: Defines button properties, validation (max 3 buttons, text limits), and API invocation.
- `send-quick-replies.action.ts`: Defines quick reply options and payload limits.
- `sender-actions.action.ts`: Defines sender action toggles (`typing_on`, `mark_seen`).

---

## 5. Acceptance Criteria & Quality Checklist

- [ ] `messenger.package.ts` is reduced from 773 lines to under 50 lines.
- [ ] Each action node is located in its own file under `actions/` with fewer than 100 lines.
- [ ] Signature validation and webhook handling are isolated and covered by dedicated unit tests.
- [ ] Integration package output of `createMessengerPackage(graph)` matches the original package definition exactly.
- [ ] All existing backend tests (`npm test`) pass without regression.

