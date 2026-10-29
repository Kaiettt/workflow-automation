import { PrismaClient, UserRole, ConnectorAuthType, NodeCategory } from '@prisma/client';
import {
  AGGREGATE_CONFIG_SCHEMA,
  API_KEY_CONNECTOR_CONFIG_SCHEMA,
  FILTER_CONFIG_SCHEMA,
  GMAIL_SEND_CONFIG_SCHEMA,
  GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA,
  LLM_GENERATE_CONFIG_SCHEMA,
  MANUAL_TRIGGER_CONFIG_SCHEMA,
  WEBHOOK_TRIGGER_CONFIG_SCHEMA,
} from './mvp-node-schemas';

export async function seedMvp(prisma: PrismaClient) {
  // Define constants for UUIDs used in sample-data
  const userId = '11111111-1111-1111-1111-111111111111';
  const googleConnectorId = '22222222-2222-2222-2222-222222222221';

  // 1. Seed User
  console.log('Seeding User...');
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: 'kiet@flowpilot.local',
      passwordHash: '$2b$10$qhBGHlAqCdvFzfzIJU5E6uE47odBXUD2pAFD50a6TY85o59vD6mTm', // Dummy hash
      name: 'Kiet Nguyen',
      role: UserRole.DEVELOPER,
      isActive: true,
    },
  });

  // 2. Seed Connector (catalog data: kept in sync on every run)
  console.log('Seeding Connector...');
  const googleConnector = {
    key: 'google',
    name: 'Google',
    authType: ConnectorAuthType.OAUTH2,
    configSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
      },
    },
    isActive: true,
  };
  await prisma.connector.upsert({
    where: { id: googleConnectorId },
    update: googleConnector,
    create: { id: googleConnectorId, ...googleConnector },
  });

  // LLM vendors: the user brings an API key (stored encrypted as a credential).
  const llmConnectors = [
    { id: '22222222-2222-2222-2222-222222222222', key: 'anthropic', name: 'Anthropic' },
    { id: '22222222-2222-2222-2222-222222222223', key: 'openai', name: 'OpenAI' },
    { id: '22222222-2222-2222-2222-222222222224', key: 'gemini', name: 'Google Gemini' },
  ];
  for (const { id, ...llmConnector } of llmConnectors) {
    const data = {
      ...llmConnector,
      authType: ConnectorAuthType.API_KEY,
      configSchema: API_KEY_CONNECTOR_CONFIG_SCHEMA,
      isActive: true,
    };
    await prisma.connector.upsert({
      where: { key: llmConnector.key },
      update: data,
      create: { id, ...data },
    });
  }

  // 3. Seed Node Type Definitions (catalog data: kept in sync on every run,
  // otherwise databases seeded earlier would keep an outdated config_schema)
  console.log('Seeding Node Type Definitions...');

  const nodeTypes = [
    {
      id: '44444444-4444-4444-4444-444444444441',
      key: 'trigger.manual',
      displayName: 'Manual Trigger',
      icon: 'play',
      color: '#6B7280',
      category: NodeCategory.TRIGGER,
      description: 'Manually start a workflow',
      configSchema: MANUAL_TRIGGER_CONFIG_SCHEMA,
      connectorId: null,
    },
    {
      id: '44444444-4444-4444-4444-444444444442',
      key: 'integration.google_sheet.readRows',
      displayName: 'Read Google Sheet Rows',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg',
      color: '#34A853',
      category: NodeCategory.INTEGRATION,
      description: 'Read rows from a Google Sheet',
      configSchema: GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA,
      connectorId: googleConnectorId,
    },
    {
      id: '44444444-4444-4444-4444-444444444443',
      key: 'logic.filter',
      displayName: 'Filter',
      icon: 'filter',
      color: '#8B5CF6',
      category: NodeCategory.LOGIC,
      description: 'Filter items based on a condition',
      configSchema: FILTER_CONFIG_SCHEMA,
      connectorId: null,
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      key: 'integration.gmail.send',
      displayName: 'Send Gmail',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUXfUL28oZ5EfH8SYzjwtutOTCD9iQrU8rszuNXKtawg&s=10',
      color: '#EA4335',
      category: NodeCategory.INTEGRATION,
      description: 'Send an email using Gmail',
      configSchema: GMAIL_SEND_CONFIG_SCHEMA,
      connectorId: googleConnectorId,
    },
    {
      id: '44444444-4444-4444-4444-444444444445',
      key: 'data.aggregate',
      displayName: 'Aggregate',
      icon: 'layers',
      color: '#F59E0B',
      category: NodeCategory.DATA_PROCESSING,
      description: 'Combine all items into a single item',
      configSchema: AGGREGATE_CONFIG_SCHEMA,
      connectorId: null,
    },
    {
      id: '44444444-4444-4444-4444-444444444446',
      key: 'ai.llm.generate',
      displayName: 'LLM',
      icon: 'sparkles',
      color: '#0EA5E9',
      category: NodeCategory.AI,
      description: 'Send a prompt to a language model and get its answer',
      configSchema: LLM_GENERATE_CONFIG_SCHEMA,
      // Not tied to one connector: the provider is chosen on the node.
      connectorId: null,
    },
    {
      id: '44444444-4444-4444-4444-444444444447',
      key: 'trigger.webhook',
      displayName: 'Webhook Trigger',
      icon: 'webhook',
      color: '#6B7280',
      category: NodeCategory.TRIGGER,
      description: 'Start a workflow when an HTTP POST arrives at its URL',
      configSchema: WEBHOOK_TRIGGER_CONFIG_SCHEMA,
      connectorId: null,
    },
  ];

  for (const { id, ...nodeType } of nodeTypes) {
    const data = {
      ...nodeType,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      isActive: true,
    };
    await prisma.nodeTypeDefinition.upsert({
      where: { key: nodeType.key },
      update: data,
      create: { id, ...data },
    });
  }

  console.log('Seeded MVP catalogs successfully!');
}
