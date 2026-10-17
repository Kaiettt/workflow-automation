import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { credentialService } from '../services/credential.service';
import type { CredentialSummary } from '../types/credential.types';

export const credentialKeys = {
  all: ['credentials'] as const,
  list: (connectorKey: string) => [...credentialKeys.all, connectorKey] as const,
};

export function useCredentials(connectorKey: string | undefined) {
  return useQuery<CredentialSummary[]>({
    queryKey: credentialKeys.list(connectorKey ?? ''),
    queryFn: () => credentialService.list(connectorKey as string),
    enabled: !!connectorKey,
  });
}

interface SaveApiKeyVariables {
  connectorKey: string;
  name: string;
  apiKey: string;
}

export function useSaveApiKeyCredential() {
  const queryClient = useQueryClient();
  return useMutation<CredentialSummary, Error, SaveApiKeyVariables>({
    mutationFn: ({ connectorKey, name, apiKey }) =>
      credentialService.saveApiKey(connectorKey, name, apiKey),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: credentialKeys.list(saved.connectorKey),
      });
    },
  });
}
