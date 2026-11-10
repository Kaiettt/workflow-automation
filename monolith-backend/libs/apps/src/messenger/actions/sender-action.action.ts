import { ActionNode } from '../../core/package';
import { MetaGraphApi, SenderAction } from '../meta-graph.api';
import {
  MESSENGER_CREDENTIAL,
  pageProperty,
} from '../credentials/messenger.credential';
import { asText, pageOf } from '../utils/messenger-helpers';
import { recipientProperty } from './send-message.action';

export const SENDER_ACTIONS: SenderAction[] = [
  'typing_on',
  'typing_off',
  'mark_seen',
];

export function createSenderAction(graph: MetaGraphApi): ActionNode {
  return {
    kind: 'action',
    key: 'messenger.senderAction',
    displayName: 'Messenger Sender Action',
    description:
      'Show "typing…" or mark the customer’s message as seen while the bot works',
    icon: 'ellipsis',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      recipientProperty,
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'typing_on',
        options: [
          { value: 'typing_on', label: 'Show typing…' },
          { value: 'typing_off', label: 'Hide typing' },
          { value: 'mark_seen', label: 'Mark as seen' },
        ],
      },
    ],
    async execute({ parameters, credential: secret }) {
      const page = pageOf(secret, parameters);
      const action = asText(parameters.action) || 'typing_on';
      if (!SENDER_ACTIONS.includes(action as SenderAction)) {
        throw new Error(`"${action}" is not a sender action`);
      }
      const recipientId = asText(parameters.recipient_id).trim();
      await graph.sendAction(
        page.access_token,
        recipientId,
        action as SenderAction,
      );
      return {
        page_id: page.id,
        recipient_id: recipientId,
        action,
        status: 'sent',
      };
    },
  };
}
