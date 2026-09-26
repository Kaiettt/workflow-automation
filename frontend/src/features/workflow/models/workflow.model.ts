
export interface NodeTypeDefinition {
    id: string;
    key: string;
    displayName: string;
    category: 'TRIGGER' | 'LOGIC' | 'DATA_PROCESSING' | 'INTEGRATION';
    icon: string | null;
    color: string | null;
    description: string | null;
    connectorId: string | null;
    configSchema: Record<string, unknown>;
}