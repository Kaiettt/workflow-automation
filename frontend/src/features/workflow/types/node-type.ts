export interface NodeType {
  id: string;
  key: string;
  displayName: string;
  icon: string;
  color: string;
  category: 'TRIGGER' | 'LOGIC' | 'INTEGRATION';
  description: string;
  configSchema: {
    type: 'object';
    required?: string[];
    properties: Record<string, unknown>;
  };
  inputSchema: unknown;
  outputSchema: unknown;
  connectorId: string | null;
  isActive: boolean;
}
