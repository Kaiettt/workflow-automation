import { apiClient } from '../../../shared/api/http-client';
import type {
  ConnectorSummary,
  CreateCredentialRequest,
  CredentialSummary,
} from '../types/credential.types';

export const credentialApi = {
  list: async (connectorKey: string): Promise<CredentialSummary[]> => {
    const res = await apiClient.get<{ data: CredentialSummary[] }>(
      `/api/connectors/${connectorKey}/credentials`,
    );
    return res.data.data;
  },

  create: async (
    connectorKey: string,
    body: CreateCredentialRequest,
  ): Promise<CredentialSummary> => {
    const res = await apiClient.post<{ data: CredentialSummary }>(
      `/api/connectors/${connectorKey}/credentials`,
      body,
    );
    return res.data.data;
  },

  listConnectors: async (): Promise<ConnectorSummary[]> => {
    const res = await apiClient.get<{ data: ConnectorSummary[] }>('/api/connectors');
    return res.data.data;
  },
};
