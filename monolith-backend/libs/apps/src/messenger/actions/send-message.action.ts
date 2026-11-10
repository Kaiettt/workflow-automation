import { ActionNode, NodeProperty } from '../../core/package';
import { MetaGraphApi } from '../meta-graph.api';
import {
  MESSENGER_CREDENTIAL,
  pageProperty,
} from '../credentials/messenger.credential';
import { asText, pageOf } from '../utils/messenger-helpers';
import {
  buildMessage,
  MAX_BUTTONS,
  MAX_QUICK_REPLIES,
  MAX_TITLE_LENGTH,
  MESSAGE_TYPES,
  MessageType,
} from './message-builder';

export const recipientProperty: NodeProperty = {
  name: 'recipient_id',
  displayName: 'Recipient ID',
  type: 'string',
  required: true,
  expression: true,
  default: '{{$node["Messenger Trigger"].json.sender_id}}',
  description:
    'Page-scoped ID of the person, e.g. sender_id of the Messenger Trigger',
};

// Fields that belong to one message type are hidden for the others.
const onlyFor = (...types: MessageType[]) => ({
  field: 'message_type',
  in: MESSAGE_TYPES.filter((type) => !types.includes(type)),
});

export function createSendMessageAction(graph: MetaGraphApi): ActionNode {
  return {
    kind: 'action',
    key: 'messenger.sendMessage',
    displayName: 'Messenger Send Message',
    description:
      'Send a message from your Facebook Page: text, quick replies, buttons or an image / file',
    icon: 'send',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      recipientProperty,
      {
        name: 'message_type',
        displayName: 'Message type',
        type: 'options',
        default: 'text',
        options: [
          { value: 'text', label: 'Text' },
          { value: 'quick_replies', label: 'Text with quick replies' },
          { value: 'buttons', label: 'Text with buttons' },
          { value: 'attachment', label: 'Image, video, audio or file' },
        ],
      },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        expression: true,
        multiline: true,
        hideWhen: onlyFor('text', 'quick_replies', 'buttons'),
      },
      {
        name: 'quick_replies',
        displayName: 'Quick replies',
        type: 'collection',
        description: `Up to ${MAX_QUICK_REPLIES}; each one disappears once the customer taps it`,
        hideWhen: onlyFor('quick_replies'),
        fields: [
          {
            name: 'title',
            displayName: 'Title',
            type: 'string',
            expression: true,
            description: `Up to ${MAX_TITLE_LENGTH} characters`,
          },
          {
            name: 'payload',
            displayName: 'Payload',
            type: 'string',
            expression: true,
            placeholder: 'e.g. PRICE',
            description: 'Comes back in the payload of the Messenger Trigger',
          },
        ],
      },
      {
        name: 'buttons',
        displayName: 'Buttons',
        type: 'collection',
        description: `Up to ${MAX_BUTTONS}`,
        hideWhen: onlyFor('buttons'),
        fields: [
          {
            name: 'type',
            displayName: 'Type',
            type: 'options',
            default: 'postback',
            options: [
              { value: 'postback', label: 'Send a payload back' },
              { value: 'web_url', label: 'Open a link' },
            ],
          },
          {
            name: 'title',
            displayName: 'Title',
            type: 'string',
            expression: true,
            description: `Up to ${MAX_TITLE_LENGTH} characters`,
          },
          {
            name: 'payload',
            displayName: 'Payload',
            type: 'string',
            expression: true,
            hideWhen: { field: 'type', in: ['web_url'] },
          },
          {
            name: 'url',
            displayName: 'Link',
            type: 'string',
            expression: true,
            placeholder: 'https://',
            hideWhen: { field: 'type', in: ['postback'] },
          },
        ],
      },
      {
        name: 'attachment_type',
        displayName: 'File type',
        type: 'options',
        default: 'image',
        options: [
          { value: 'image', label: 'Image' },
          { value: 'video', label: 'Video' },
          { value: 'audio', label: 'Audio' },
          { value: 'file', label: 'File' },
        ],
        hideWhen: onlyFor('attachment'),
      },
      {
        name: 'attachment_url',
        displayName: 'File URL',
        type: 'string',
        expression: true,
        placeholder: 'https://',
        description: 'A public link Messenger can download from',
        hideWhen: onlyFor('attachment'),
      },
    ],
    async execute({ parameters, credential: secret }) {
      const page = pageOf(secret, parameters);
      const message = buildMessage(parameters);
      const recipientId = asText(parameters.recipient_id).trim();
      const { messageId } = await graph.sendMessage(
        page.access_token,
        recipientId,
        message,
      );
      return {
        page_id: page.id,
        recipient_id: recipientId,
        message_id: messageId,
        status: 'sent',
      };
    },
  };
}
