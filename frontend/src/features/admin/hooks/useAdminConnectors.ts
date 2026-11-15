import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import type {
  ChangeConnectorPolicyPayload,
  ConnectorFilter,
} from '../types/admin.types';

export const ADMIN_CONNECTORS_KEY = ['admin', 'connectors'] as const;
export const ADMIN_CONNECTOR_KEY = (id: string) =>
  ['admin', 'connector', id] as const;

export function useAdminConnectors(filter: ConnectorFilter) {
  return useQuery({
    queryKey: [...ADMIN_CONNECTORS_KEY, filter],
    queryFn: ({ signal }) => adminService.connectors(filter, signal),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useAdminConnector(id: string) {
  return useQuery({
    queryKey: ADMIN_CONNECTOR_KEY(id),
    queryFn: ({ signal }) => adminService.connector(id, signal),
    enabled: Boolean(id),
  });
}

export function useChangeConnectorPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ChangeConnectorPolicyPayload;
    }) => adminService.changeConnectorPolicy(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_CONNECTORS_KEY });
      queryClient.invalidateQueries({
        queryKey: ADMIN_CONNECTOR_KEY(variables.id),
      });
    },
  });
}

