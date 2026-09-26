import { PrismaClient, UserRole, ConnectorAuthType, NodeCategory, Prisma } from '@prisma/client';

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

  // 2. Seed Connector
  console.log('Seeding Connector...');
  await prisma.connector.upsert({
    where: { id: googleConnectorId },
    update: {},
    create: {
      id: googleConnectorId,
      key: 'google',
      name: 'Google',
      authType: ConnectorAuthType.OAUTH2,
      configSchema: {
        type: 'object',
        properties: {
          client_id: { type: 'string' }
        }
      },
      isActive: true,
    },
  });

  // 3. Seed Node Type Definitions
  console.log('Seeding Node Type Definitions...');

  // 3.1 Trigger Manual
  await prisma.nodeTypeDefinition.upsert({
    where: { key: 'trigger.manual' },
    update: {},
    create: {
      id: '44444444-4444-4444-4444-444444444441',
      key: 'trigger.manual',
      displayName: 'Manual Trigger',
      icon: 'play',
      color: '#6B7280',
      category: NodeCategory.TRIGGER,
      description: 'Manually start a workflow',
      configSchema: { type: 'object', properties: {} },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      connectorId: null,
      isActive: true,
    },
  });

  // 3.2 Google Sheet Read Rows
  await prisma.nodeTypeDefinition.upsert({
    where: { key: 'integration.google_sheet.readRows' },
    update: {},
    create: {
      id: '44444444-4444-4444-4444-444444444442',
      key: 'integration.google_sheet.readRows',
      displayName: 'Read Google Sheet Rows',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg',
      color: '#34A853',
      category: NodeCategory.INTEGRATION,
      description: 'Read rows from a Google Sheet',
      configSchema: {
        type: 'object',
        required: ['credential_id', 'spreadsheet_id', 'sheet_name'],
        properties: {
          credential_id: { type: 'string', 'x-connectorKey': 'google' },
          spreadsheet_id: { type: 'string' },
          sheet_name: { type: 'string' }
        }
      },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      connectorId: googleConnectorId,
      isActive: true,
    },
  });

  // 3.3 Logic Filter
  await prisma.nodeTypeDefinition.upsert({
    where: { key: 'logic.filter' },
    update: {},
    create: {
      id: '44444444-4444-4444-4444-444444444443',
      key: 'logic.filter',
      displayName: 'Filter',
      icon: 'filter',
      color: '#8B5CF6',
      category: NodeCategory.LOGIC,
      description: 'Filter items based on a condition',
      configSchema: {
        type: 'object',
        required: ['field', 'operator', 'value'],
        properties: {
          field: { type: 'string', 'x-allowExpression': true },
          operator: { type: 'string', enum: ['equals', 'not_equals', 'contains'] },
          value: { type: 'string', 'x-allowExpression': true }
        }
      },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      connectorId: null,
      isActive: true,
    },
  });

  // 3.4 Gmail Send
  await prisma.nodeTypeDefinition.upsert({
    where: { key: 'integration.gmail.send' },
    update: {},
    create: {
      id: '44444444-4444-4444-4444-444444444444',
      key: 'integration.gmail.send',
      displayName: 'Send Gmail',
      icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUXfUL28oZ5EfH8SYzjwtutOTCD9iQrU8rszuNXKtawg&s=10',
      color: '#EA4335',
      category: NodeCategory.INTEGRATION,
      description: 'Send an email using Gmail',
      configSchema: {
        type: 'object',
        required: ['credential_id', 'subject', 'body'],
        properties: {
          credential_id: { type: 'string', 'x-connectorKey': 'google' },
          subject: { type: 'string', 'x-allowExpression': true },
          body: { type: 'string', 'x-allowExpression': true }
        }
      },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      connectorId: googleConnectorId,
      isActive: true,
    },
  });

  console.log('Seeded MVP catalogs successfully!');
}


