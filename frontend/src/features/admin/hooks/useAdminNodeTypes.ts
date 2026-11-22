import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminService } from "../services/admin.service";
import type {
  ChangeNodeTypeStatusPayload,
  NodeTypeFilter,
} from "../types/admin.types";

export const adminNodeTypeKeys = {
  all: ["admin", "node-types"] as const,
  detail: (key: string) => ["admin", "node-type", key] as const,
};
export function useAdminNodeTypes(filter: NodeTypeFilter) {
  return useQuery({
    queryKey: [...adminNodeTypeKeys.all, filter],
    queryFn: ({ signal }) => adminService.nodeTypes(filter, signal),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
export function useAdminNodeType(key: string, enabled = true) {
  return useQuery({
    queryKey: adminNodeTypeKeys.detail(key),
    queryFn: ({ signal }) => adminService.nodeType(key, signal),
    enabled: Boolean(key) && enabled,
  });
}
export function useChangeNodeTypeStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      payload,
    }: {
      key: string;
      payload: ChangeNodeTypeStatusPayload;
    }) => adminService.changeNodeTypeStatus(key, payload),
    onSuccess: async (_, { key }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminNodeTypeKeys.all }),
        client.invalidateQueries({ queryKey: adminNodeTypeKeys.detail(key) }),
        client.invalidateQueries({ queryKey: ["node-types"] }),
        client.invalidateQueries({ queryKey: ["node-metadata"] }),
      ]);
    },
    onError: async (_, { key }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminNodeTypeKeys.all }),
        client.invalidateQueries({ queryKey: adminNodeTypeKeys.detail(key) }),
      ]);
    },
  });
}
