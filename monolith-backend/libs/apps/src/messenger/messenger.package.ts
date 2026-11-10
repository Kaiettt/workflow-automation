import { IntegrationPackage } from '../core/package';
import { MetaGraphApi } from './meta-graph.api';
import { createMessengerCredential } from './credentials/messenger.credential';
import { createMessengerTrigger } from './triggers/messenger.trigger';
import { createSendMessageAction } from './actions/send-message.action';
import { createSenderAction } from './actions/sender-action.action';

// Re-exports for consumers and tests to guarantee 100% backwards compatibility
export { MESSENGER_CREDENTIAL } from './credentials/messenger.credential';
export { buildMessage } from './actions/message-builder';
export { isValidMetaSignature } from './utils/signature-validator';
export { parseMessengerEvents } from './utils/messenger-helpers';

// Facebook Page messages through the user's own Meta App: App ID and App
// Secret are typed into the credential, the Page tokens come from OAuth.
export function createMessengerPackage(
  graph: MetaGraphApi,
): IntegrationPackage {
  const credential = createMessengerCredential(graph);
  const trigger = createMessengerTrigger(graph);
  const sendMessage = createSendMessageAction(graph);
  const senderAction = createSenderAction(graph);

  return {
    key: 'messenger',
    displayName: 'Facebook Messenger',
    credentials: [credential],
    nodes: [trigger, sendMessage, senderAction],
  };
}
