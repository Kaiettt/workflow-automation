import { apiClient } from '../../../shared/api/http-client';
import type {
  CreateApiKeyCredentialRequest,
  CredentialSummary,
} from '../types/credential.types';

export const credentialApi = {
  list: async (connectorKey: string): Promise<CredentialSummary[]> => {
    const res = await apiClient.get<{ data: CredentialSummary[] }>(
      `/api/connectors/${connectorKey}/credentials`,
    );
    return res.data.data;
  },

  createApiKey: async (
    connectorKey: string,
    body: CreateApiKeyCredentialRequest,
  ): Promise<CredentialSummary> => {
    const res = await apiClient.post<{ data: CredentialSummary }>(
      `/api/connectors/${connectorKey}/credentials`,
      body,
    );
    return res.data.data;
  },
};
