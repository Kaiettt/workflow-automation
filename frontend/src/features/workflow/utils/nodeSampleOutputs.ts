export interface ExpressionShortcut {
  label: string;
  field: string;
  description: string;
  example: string;
}

export interface NodeOutputSample {
  data: Record<string, unknown>;
  description: string;
  shortcuts: ExpressionShortcut[];
}

export const NODE_SAMPLE_OUTPUTS: Record<string, NodeOutputSample> = {
  'trigger.manual': {
    description: 'Manual Trigger creates an empty item to start the data flow.',
    data: {},
    shortcuts: [],
  },

  'webhook.trigger': {
    description: 'Data received from an external system through an HTTP POST webhook.',
    data: {
      body: {
        order_id: 'ORD-9988',
        customer_name: 'John Doe',
        customer_email: 'john.doe@example.com',
        total_amount: 1250000,
        items_count: 2,
      },
      headers: {
        'content-type': 'application/json',
      },
      query: {},
    },
    shortcuts: [
      { label: 'Order ID', field: 'body.order_id', description: 'Order ID from the webhook', example: 'ORD-9988' },
      { label: 'Customer email', field: 'body.customer_email', description: 'Customer email address', example: 'john.doe@example.com' },
      { label: 'Customer name', field: 'body.customer_name', description: 'Customer full name', example: 'John Doe' },
      { label: 'Total amount', field: 'body.total_amount', description: 'Payment amount', example: '1250000' },
    ],
  },

  'messenger.trigger': {
    description: 'A customer message or button event received through Facebook Messenger.',
    data: {
      type: 'message',
      message_id: 'mid.1794031200:a8f9c1b2',
      sender_id: '8492019481029481',
      page_id: '100294819201948',
      text: 'How much is your mechanical keyboard?',
      payload: null,
      timestamp: '2026-11-07T08:30:00.000Z',
    },
    shortcuts: [
      { label: 'Customer ID (sender ID)', field: 'sender_id', description: 'Required as the recipient ID when sending a message', example: '8492019481029481' },
      { label: 'Message text', field: 'text', description: 'Customer message to include in the AI prompt', example: 'How much is your keyboard?' },
      { label: 'Page ID', field: 'page_id', description: 'ID of the page receiving the message', example: '100294819201948' },
      { label: 'Button payload', field: 'payload', description: 'Value received when a customer selects a quick reply or button', example: 'PRICE_INQUIRY' },
    ],
  },

  'logic.if': {
    description: 'Passes the unchanged item to the True or False output according to the condition.',
    data: {
      text: 'How much is your keyboard?',
      sender_id: '8492019481029481',
    },
    shortcuts: [
      { label: 'True/False branch data', field: 'text', description: 'Includes all fields from the previous node', example: '...' },
    ],
  },

  'logic.switch': {
    description: 'Passes the input item unchanged through the matching rule output or fallback.',
    data: {
      text: 'Product price inquiry',
      matched_rule: 'Price inquiry',
    },
    shortcuts: [
      { label: 'Routed item data', field: 'text', description: 'Inherits data from the previous node', example: '...' },
    ],
  },

  'logic.filter': {
    description: 'Passes matching items through and removes items that do not match the condition.',
    data: {
      status: 'PENDING',
      order_id: 'ORD-12345',
    },
    shortcuts: [
      { label: 'Status', field: 'status', description: 'Field from a matching item', example: 'PENDING' },
    ],
  },

  'data.set': {
    description: 'Data after adding new fields or transforming its structure.',
    data: {
      full_name: 'John Doe',
      email: 'john.doe@example.com',
      greeting: 'Hello John Doe!',
    },
    shortcuts: [
      { label: 'Full name', field: 'full_name', description: 'Newly assigned field', example: 'John Doe' },
      { label: 'Greeting', field: 'greeting', description: 'Combined text', example: 'Hello John Doe!' },
    ],
  },

  'data.aggregate': {
    description: 'Combines all incoming items into a single array.',
    data: {
      items: [
        { id: 1, product: 'AK820 mechanical keyboard', price: 850000 },
        { id: 2, product: 'X1 wireless mouse', price: 450000 },
      ],
    },
    shortcuts: [
      { label: 'Items array', field: 'items', description: 'Array containing all collected items', example: '[{...}, {...}]' },
      { label: 'Item count', field: 'items.length', description: 'Total number of collected items', example: '2' },
      { label: 'First item', field: 'items[0].product', description: 'First product in the array', example: 'AK820 mechanical keyboard' },
    ],
  },

  'memory.chat': {
    description: 'Conversation history loaded from Redis for the AI model.',
    data: {
      history: [
        { role: 'user', content: 'Do you sell mechanical keyboards?' },
        { role: 'assistant', content: 'Yes, we offer several mechanical keyboard models.' },
      ],
      history_text: 'User: Do you sell mechanical keyboards?\nAssistant: Yes, we offer several mechanical keyboard models.',
    },
    shortcuts: [
      { label: 'Conversation history', field: 'history', description: 'Use this value in the AI node conversation history field', example: '[{role, content}]' },
      { label: 'History text', field: 'history_text', description: 'Conversation turns combined as text', example: 'User: ... Assistant: ...' },
    ],
  },

  'ai.llm.generate': {
    description: 'A response generated by an AI model (OpenAI, Claude, or Gemini).',
    data: {
      text: 'The AK820 mechanical keyboard is on sale for 790,000 VND with a 12-month warranty.',
      model: 'gpt-4o-mini',
      usage: {
        input_tokens: 128,
        output_tokens: 42,
      },
    },
    shortcuts: [
      { label: 'AI response', field: 'text', description: 'AI response to send to the customer or save as a note', example: 'The mechanical keyboard…' },
      { label: 'Model', field: 'model', description: 'AI model used for this response', example: 'gpt-4o-mini' },
      { label: 'Output tokens', field: 'usage.output_tokens', description: 'Number of output tokens used', example: '42' },
    ],
  },

  'http.request': {
    description: 'Response data from an external API after an HTTP request.',
    data: {
      status: 200,
      data: {
        success: true,
        order_id: 'ORD-7788',
        tracking_code: 'VNPOST-9921',
      },
      headers: {
        'content-type': 'application/json',
      },
    },
    shortcuts: [
      { label: 'Response data', field: 'data', description: 'Complete JSON response returned by the API', example: '{"success": true, ...}' },
      { label: 'HTTP status code', field: 'status', description: 'HTTP response code (200, 201, 400, etc.)', example: '200' },
      { label: 'Tracking code', field: 'data.tracking_code', description: 'Nested field in the API response', example: 'VNPOST-9921' },
    ],
  },

  'integration.google_sheet.readRows': {
    description: 'A row read from Google Sheets. Each row becomes a separate item.',
    data: {
      row_number: 2,
      'Full name': 'John Doe',
      Email: 'john.doe@example.com',
      'Phone number': '0912345678',
      'Status': 'Pending',
    },
    shortcuts: [
      { label: 'Full name column', field: '["Full name"]', description: 'A column name containing spaces', example: 'John Doe' },
      { label: 'Email column', field: 'Email', description: 'Recipient email column', example: 'john.doe@example.com' },
      { label: 'Phone number column', field: '["Phone number"]', description: 'Phone number column', example: '0912345678' },
      { label: 'Row number', field: 'row_number', description: 'Row position in Google Sheets', example: '2' },
    ],
  },

  'integration.gmail.send': {
    description: 'The result of sending an email successfully through Gmail.',
    data: {
      message_id: '18c2f1a980b192cd',
      to: 'john.doe@example.com',
      sent: true,
    },
    shortcuts: [
      { label: 'Message ID', field: 'message_id', description: 'Email message ID returned by Google', example: '18c2f1a9...' },
      { label: 'Send status', field: 'sent', description: 'True when the message was sent successfully', example: 'true' },
    ],
  },

  'messenger.sendMessage': {
    description: 'The Meta Graph API response after sending a Messenger message.',
    data: {
      page_id: '100294819201948',
      recipient_id: '8492019481029481',
      message_id: 'm_1792837192',
      status: 'sent',
    },
    shortcuts: [
      { label: 'Message ID', field: 'message_id', description: 'ID of the sent message', example: 'm_1792837192' },
      { label: 'Send status', field: 'status', description: 'Message status', example: 'sent' },
    ],
  },

  'messenger.senderAction': {
    description: 'The result of sending a typing indicator or read receipt.',
    data: {
      page_id: '100294819201948',
      recipient_id: '8492019481029481',
      action: 'typing_on',
      status: 'sent',
    },
    shortcuts: [
      { label: 'Sent action', field: 'action', description: 'typing_on / typing_off / mark_seen', example: 'typing_on' },
      { label: 'Status', field: 'status', description: 'Send status', example: 'sent' },
    ],
  },
};

