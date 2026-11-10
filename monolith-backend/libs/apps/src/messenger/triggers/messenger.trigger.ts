import { randomBytes } from 'node:crypto';
import { TriggerNode } from '../../core/package';
import { MetaGraphApi } from '../meta-graph.api';
import {
  MESSENGER_CREDENTIAL,
  pageProperty,
} from '../credentials/messenger.credential';
import { createMessengerLifecycle } from './webhook/messenger-lifecycle';
import {
  acceptsMessengerEvent,
  handleMessengerWebhook,
} from './webhook/messenger-webhook.handler';

export function createMessengerTrigger(graph: MetaGraphApi): TriggerNode {
  const lifecycle = createMessengerLifecycle(graph);

  return {
    kind: 'trigger',
    key: 'messenger.trigger',
    displayName: 'Messenger Trigger',
    description: 'Start when a customer messages your Facebook Page',
    icon: 'message-circle',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      {
        name: 'events',
        displayName: 'Events',
        type: 'options',
        default: 'all',
        options: [
          { value: 'all', label: 'Messages and button clicks' },
          { value: 'message', label: 'Messages only' },
          { value: 'postback', label: 'Button clicks only' },
        ],
        description:
          'A button click (postback) starts the workflow with its payload',
      },
      {
        name: 'keywords',
        displayName: 'Keywords',
        type: 'string',
        placeholder: 'e.g. giá, bảng giá',
        description:
          'Optional. Only events whose text or payload contains one of these words (comma separated; case and accents do not matter). Empty: every event.',
      },
    ],
    webhook: {
      // One Meta App has a single callback URL for Page events.
      scope: 'credential',
      initialData: () => ({ verify_token: randomBytes(24).toString('hex') }),
      checkExists: (context) => lifecycle.checkExists(context),
      create: (context) => lifecycle.create(context),
      delete: (context) => lifecycle.delete(context),
      handle: handleMessengerWebhook,
      accepts: acceptsMessengerEvent,
    },
  };
}
