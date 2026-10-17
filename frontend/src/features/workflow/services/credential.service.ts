import { credentialApi } from '../api/credential.api';
import type { CredentialSummary } from '../types/credential.types';

export const credentialService = {
  list: (connectorKey: string): Promise<CredentialSummary[]> =>
    credentialApi.list(connectorKey),

  saveApiKey: (
    connectorKey: string,
    name: string,
    apiKey: string,
  ): Promise<CredentialSummary> =>
    credentialApi.createApiKey(connectorKey, {
      name: name.trim(),
      api_key: apiKey.trim(),
    }),
};
