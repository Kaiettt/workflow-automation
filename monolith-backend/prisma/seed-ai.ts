import { PrismaClient, ConnectorAuthType, NodeCategory } from '@prisma/client';
import {
  AGGREGATE_CONFIG_SCHEMA,
  API_KEY_CONNECTOR_CONFIG_SCHEMA,
  FILTER_CONFIG_SCHEMA,
  GMAIL_SEND_CONFIG_SCHEMA,
  GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA,
  LLM_GENERATE_CONFIG_SCHEMA,
  MANUAL_TRIGGER_CONFIG_SCHEMA,
} from './mvp-node-schemas';

// Catalog added by the item model and the LLM node. It runs after seedMvp and
// is kept in sync on every run, so databases seeded earlier get the new schemas.
export async function seedAi(prisma: PrismaClient) {
  // 1. LLM vendors: the user brings an API key (stored encrypted as a credential).
  console.log('Seeding LLM connectors...');
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

  // 2. New node types
  console.log('Seeding Aggregate and LLM node types...');
  const nodeTypes = [
    {
      id: '44444444-4444-4444-4444-444444444445',
      key: 'data.aggregate',
      displayName: 'Aggregate',
      icon: 'layers',
      color: '#F59E0B',
      category: NodeCategory.DATA_PROCESSING,
      description: 'Combine all items into a single item',
      configSchema: AGGREGATE_CONFIG_SCHEMA,
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
    },
  ];
  for (const { id, ...nodeType } of nodeTypes) {
    const data = {
      ...nodeType,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      // Not tied to one connector: the provider is chosen on the node.
      connectorId: null,
      isActive: true,
    };
    await prisma.nodeTypeDefinition.upsert({
      where: { key: nodeType.key },
      update: data,
      create: { id, ...data },
    });
  }

  // 3. Existing node types: only their config schema changed (expressions,
  // field order, Gmail `to`), so nothing else on them is touched.
  console.log('Updating config schemas of the MVP node types...');
  const updatedSchemas = [
    ['trigger.manual', MANUAL_TRIGGER_CONFIG_SCHEMA],
    ['integration.google_sheet.readRows', GOOGLE_SHEET_READ_ROWS_CONFIG_SCHEMA],
    ['logic.filter', FILTER_CONFIG_SCHEMA],
    ['integration.gmail.send', GMAIL_SEND_CONFIG_SCHEMA],
  ] as const;
  for (const [key, configSchema] of updatedSchemas) {
    await prisma.nodeTypeDefinition.update({
      where: { key },
      data: { configSchema },
    });
  }

  console.log('Seeded AI catalogs successfully!');
}
