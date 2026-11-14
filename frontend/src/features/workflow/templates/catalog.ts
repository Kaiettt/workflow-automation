import type { Edge, Node } from '@xyflow/react';

export interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
}

function node(id: string, key: string, name: string, x: number, y: number, config: Record<string, unknown> = {}): Node {
  const type = key.startsWith('messenger.trigger') || key.startsWith('webhook.') || key === 'trigger.manual' ? 'triggerNode' : 'actionNode';
  return { id, type, position: { x, y }, data: { key, name, config } };
}

function edge(source: string, target: string, id: string, sourceHandle = 'right-source', targetHandle = 'left-target'): Edge {
  return { id, source, target, sourceHandle, targetHandle, type: 'smoothstep' };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'messenger-ai-chatbot', title: 'Messenger AI Chatbot',
    description: 'Reply to Facebook messages with an AI assistant and keep conversation context in Redis.',
    tags: ['Messenger', 'AI', 'Redis'],
    nodes: [
      node('trigger', 'messenger.trigger', 'Messenger Trigger', 0, 120),
      node('typing', 'messenger.senderAction', 'Show typing', 260, 120, { action: 'typing_on', recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}' }),
      node('memory-load', 'memory.chat', 'Load Chat Memory', 520, 120, { mode: 'load', session_key: '{{$node["Messenger Trigger"].json.sender_id}}', window: 10 }),
      node('llm', 'ai.llm.generate', 'AI Reply', 780, 120, { provider: 'openai', model: 'gpt-4o-mini', prompt: '{{$node["Messenger Trigger"].json.text}}', history: '{{$node["Load Chat Memory"].json.history}}', output_format: 'text', max_tokens: 1024 }),
      node('send', 'messenger.sendMessage', 'Send Messenger Reply', 1040, 120, { recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}', text: '{{$node["AI Reply"].json.text}}', message_type: 'text' }),
      node('memory-save', 'memory.chat', 'Save Chat Turn', 1300, 120, { mode: 'save', session_key: '{{$node["Messenger Trigger"].json.sender_id}}', user_message: '{{$node["Messenger Trigger"].json.text}}', assistant_message: '{{$node["AI Reply"].json.text}}', ttl_days: 7 }),
    ],
    edges: [edge('trigger', 'typing', 'e1'), edge('typing', 'memory-load', 'e2'), edge('memory-load', 'llm', 'e3'), edge('llm', 'send', 'e4'), edge('send', 'memory-save', 'e5')],
  },
  {
    id: 'sheets-email-notification', title: 'Google Sheets to Email',
    description: 'Read rows from a spreadsheet and send each row as an email notification.',
    tags: ['Google Sheets', 'Email'],
    nodes: [
      node('manual', 'trigger.manual', 'Manual Trigger', 0, 120),
      node('sheets', 'integration.google_sheet.readRows', 'Read Google Sheet Rows', 300, 120, { spreadsheet_id: '', sheet_name: 'Sheet1' }),
      node('gmail', 'integration.gmail.send', 'Send Gmail', 600, 120, { to: '{{$json.Email}}', subject: 'Notification: {{$json["Full name"]}}', body: 'Hello {{$json["Full name"]}},\n\nThis is an automated notification.' }),
    ],
    edges: [edge('manual', 'sheets', 'e1'), edge('sheets', 'gmail', 'e2')],
  },
  {
    id: 'messenger-ai-routing', title: 'Messenger AI Classification',
    description: 'Classify incoming Messenger messages with AI and route them through a Switch node.',
    tags: ['Messenger', 'AI', 'Routing'],
    nodes: [
      node('trigger', 'messenger.trigger', 'Messenger Trigger', 0, 140),
      node('llm', 'ai.llm.generate', 'Classify Message', 320, 140, { provider: 'openai', model: 'gpt-4o-mini', prompt: 'Classify this message as sales, support, or other. Return JSON with an intent field. Message: {{$json.text}}', output_format: 'json', max_tokens: 256 }),
      node('switch', 'logic.switch', 'Route by Intent', 640, 140, { mode: 'first', rules: [{ label: 'Sales', conditions: [{ value1: '{{$node["Classify Message"].json.data.intent}}', operator: 'equals', value2: 'sales' }] }, { label: 'Support', conditions: [{ value1: '{{$node["Classify Message"].json.data.intent}}', operator: 'equals', value2: 'support' }] }] }),
      node('sales', 'messenger.sendMessage', 'Sales Reply', 960, 40, { recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}', text: 'Thanks for your interest. Our sales team will help you shortly.', message_type: 'text' }),
      node('support', 'messenger.sendMessage', 'Support Reply', 960, 180, { recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}', text: 'We received your support request and will be in touch soon.', message_type: 'text' }),
      node('other', 'messenger.sendMessage', 'General Reply', 960, 320, { recipient_id: '{{$node["Messenger Trigger"].json.sender_id}}', text: 'Thanks for your message. How can we help?', message_type: 'text' }),
    ],
    edges: [edge('trigger', 'llm', 'e1'), edge('llm', 'switch', 'e2'), edge('switch', 'sales', 'e3', 'out:rule_0', 'left-target'), edge('switch', 'support', 'e4', 'out:rule_1', 'left-target'), edge('switch', 'other', 'e5', 'out:fallback', 'left-target')],
  },
  {
    id: 'webhook-filter-http', title: 'Webhook Filter and HTTP Request',
    description: 'Receive an HTTP event, filter it, then call an external API with the matching data.',
    tags: ['Webhook', 'HTTP', 'Filter'],
    nodes: [
      node('webhook', 'webhook.trigger', 'Webhook Trigger', 0, 120),
      node('filter', 'logic.filter', 'Filter Event', 320, 120, { field: 'body.status', operator: 'equals', value: 'approved' }),
      node('http', 'http.request', 'Call External API', 640, 120, { method: 'POST', url: 'https://api.example.com/orders/{{$json.body.order_id}}', authentication: 'none', body_type: 'json', body: '{{$json.body}}' }),
    ],
    edges: [edge('webhook', 'filter', 'e1'), edge('filter', 'http', 'e2')],
  },
];
