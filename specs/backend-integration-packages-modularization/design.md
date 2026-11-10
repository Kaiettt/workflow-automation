# Technical Design: Modularize Monolithic Integration Packages (`messenger.package.ts`)

## 1. Current State & Technical Debt

The Messenger package is implemented as a single 773-line file (`monolith-backend/libs/apps/src/messenger/messenger.package.ts`). It houses all definitions, OAuth exchanges, signature checks, webhook subscription lifecycles, and 5 distinct action nodes in a single factory function `createMessengerPackage(graph: MetaGraphApi)`.

### Key Problems:
1. **Single Responsibility Violation:** One file handles encryption, Meta OAuth token lifecycles, HTTP webhook subscriptions, event filtering, and multiple message dispatch schemas.
2. **High Modification Risk:** Adding a new property or payload type to `messenger.send_buttons` touches the same file that manages webhook signature validation and credential exchange.
3. **Impediment to Extensibility:** New developers cannot easily see what actions are supported without scrolling through 700+ lines.

---

## 2. Target Modular Architecture

```
monolith-backend/libs/apps/src/messenger/
├── index.ts                           # Public exports
├── meta-graph.api.ts                  # Meta Graph API HTTP Client (unchanged)
├── messenger.package.ts               # IntegrationPackage assembler (< 50 lines)
│
├── credentials/
│   └── messenger.credential.ts        # Credential definition & OAuth2 token exchange
│
├── triggers/
│   ├── messenger.trigger.ts           # messenger.trigger node definition
│   └── webhook/
│       ├── messenger-webhook.handler.ts # Verification handshake, HMAC validation, event parser
│       └── messenger-lifecycle.ts     # Meta App & Page subscription check, create, delete
│
├── actions/
│   ├── send-text.action.ts            # messenger.send_text
│   ├── send-buttons.action.ts         # messenger.send_buttons
│   ├── send-quick-replies.action.ts   # messenger.send_quick_replies
│   └── sender-actions.action.ts       # messenger.typing_indicator & messenger.mark_seen
│
└── utils/
    ├── signature-validator.ts         # HMAC-SHA256 signature calculation & timingSafeEqual
    └── messenger-helpers.ts           # Page/token extraction and array validation helpers
```

---

## 3. Submodule Design & Contracts

### 3.1 Utilities (`utils/`)
- `signature-validator.ts`:
  - `isValidMetaSignature(rawBody: Buffer | undefined, headerSignature: string | undefined, appSecret: string | undefined): boolean`
  - Encapsulates `createHmac('sha256', appSecret)` and `timingSafeEqual`.
- `messenger-helpers.ts`:
  - Pure parsing utilities: `appOf`, `appTokenOf`, `pagesOf`, `stringList`, `hasAll`, `listenedPages`, `parseMessengerEvents`.

### 3.2 Credentials (`credentials/`)
- `messenger.credential.ts`:
  - Exports `createMessengerCredential(graph: MetaGraphApi): CredentialType`.
  - Defines `MESSENGER_CREDENTIAL = 'facebookMessengerOAuth2'`.
  - Encapsulates `exchangeCode` which retrieves short-lived token, converts to long-lived token, and fetches page tokens via `graph.listPages`.

### 3.3 Triggers & Webhook (`triggers/`)
- `triggers/webhook/messenger-lifecycle.ts`:
  - `createMessengerLifecycle(graph: MetaGraphApi)`: Implements `checkExists`, `create`, `delete` for Meta App subscription.
- `triggers/webhook/messenger-webhook.handler.ts`:
  - `handleMessengerWebhook(request, secret, data)`: Handles `hub.challenge` verification for `GET` and signature verification with event parsing for `POST`.
  - `acceptsMessengerEvent(event, parameters)`: Keyword and event type (`message` vs `postback`) filtering.
- `triggers/messenger.trigger.ts`:
  - Exports `createMessengerTrigger(graph: MetaGraphApi): TriggerNode`.

### 3.4 Actions (`actions/`)
Each action file exports a dedicated factory function accepting `MetaGraphApi`:
- `send-text.action.ts`: `createSendTextAction(graph: MetaGraphApi): ActionNode`
- `send-buttons.action.ts`: `createSendButtonsAction(graph: MetaGraphApi): ActionNode`
- `send-quick-replies.action.ts`: `createSendQuickRepliesAction(graph: MetaGraphApi): ActionNode`
- `sender-actions.action.ts`: Exports `createTypingIndicatorAction(graph)` and `createMarkSeenAction(graph)`.

### 3.5 Top-level Assembler (`messenger.package.ts`)
```typescript
import { IntegrationPackage } from '../core/package';
import { MetaGraphApi } from './meta-graph.api';
import { createMessengerCredential } from './credentials/messenger.credential';
import { createMessengerTrigger } from './triggers/messenger.trigger';
import { createSendTextAction } from './actions/send-text.action';
import { createSendButtonsAction } from './actions/send-buttons.action';
import { createSendQuickRepliesAction } from './actions/send-quick-replies.action';
import { createTypingIndicatorAction, createMarkSeenAction } from './actions/sender-actions.action';

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

---

## 4. Invariant Guarantees & Compatibility

1. **No Runtime Changes:** All node keys (`messenger.trigger`, `messenger.send_text`, `messenger.send_buttons`, `messenger.send_quick_replies`, `messenger.typing_indicator`, `messenger.mark_seen`) and their parameter properties remain identical.
2. **Zero Schema Divergence:** Existing workflows referencing Messenger nodes will execute without schema migration or version bump.
3. **Preserved Export:** `MESSENGER_CREDENTIAL` and `createMessengerPackage` remain the primary exports of the messenger feature.

