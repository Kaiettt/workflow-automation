import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { credentialService } from '../services/credential.service';
import type { ConnectorSummary, CredentialSummary } from '../types/credential.types';

export const credentialKeys = {
  all: ['credentials'] as const,
  list: (connectorKey: string) => [...credentialKeys.all, connectorKey] as const,
  connectors: ['connectors'] as const,
};

export function useCredentials(connectorKey: string | undefined) {
  return useQuery<CredentialSummary[]>({
    queryKey: credentialKeys.list(connectorKey ?? ''),
    queryFn: () => credentialService.list(connectorKey as string),
    enabled: !!connectorKey,
  });
}

// The catalog rarely changes: fetched once per session.
export function useConnector(connectorKey: string | undefined) {
  return useQuery<ConnectorSummary[], Error, ConnectorSummary | undefined>({
    queryKey: credentialKeys.connectors,
    queryFn: () => credentialService.listConnectors(),
    staleTime: Infinity,
    enabled: !!connectorKey,
    select: (connectors) => connectors.find((c) => c.key === connectorKey),
  });
}

interface SaveCredentialVariables {
  connectorKey: string;
  name: string;
  values: Record<string, string>;
}

export function useSaveCredential() {
  const queryClient = useQueryClient();
  return useMutation<CredentialSummary, Error, SaveCredentialVariables>({
    mutationFn: ({ connectorKey, name, values }) =>
      credentialService.save(connectorKey, name, values),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: credentialKeys.list(saved.connectorKey),
      });
    },
  });
}
