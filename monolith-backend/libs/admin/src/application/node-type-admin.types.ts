export type NodeTypeCategory =
  'TRIGGER' | 'LOGIC' | 'DATA_PROCESSING' | 'INTEGRATION' | 'AI';
export interface NodeTypeFilter {
  page: number;
  pageSize: number;
  q?: string;
  category?: NodeTypeCategory;
  connectorId?: string;
  isCatalogVisible?: boolean;
  isExecutionAllowed?: boolean;
  sortBy?: 'displayName' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
export interface NodeTypeAdminSummary {
  id: string;
  key: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  category: NodeTypeCategory;
  connectorId: string | null;
  connectorKey: string | null;
  connectorName: string | null;
  isCatalogVisible: boolean;
  isExecutionAllowed: boolean;
  revision: number;
  publishedWorkflowCount: number;
  draftWorkflowCount: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface NodeTypeAdminDetail extends NodeTypeAdminSummary {
  configSchema: unknown;
  inputSchema: unknown;
  outputSchema: unknown;
  workflows: {
    id: string;
    name: string;
    ownerEmail: string;
    status: 'DRAFT' | 'PUBLISHED';
  }[];
}
export interface NodeTypeAdminPage {
  items: NodeTypeAdminSummary[];
  total: number;
  page: number;
  pageSize: number;
}
