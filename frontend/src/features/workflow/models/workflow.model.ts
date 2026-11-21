
export interface NodeTypeDefinition {
    id: string;
    key: string;
    displayName: string;
    category: 'TRIGGER' | 'LOGIC' | 'DATA_PROCESSING' | 'INTEGRATION' | 'AI';
    icon: string | null;
    color: string | null;
    description: string | null;
    connectorId: string | null;
    isCatalogVisible?: boolean;
    isExecutionAllowed?: boolean;
    configSchema: Record<string, unknown>;
}