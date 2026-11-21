import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { useNodeTypes, useNodeMetadata } from "./useWorkflowDraft";

export function useDesignerNodeCatalog(nodes: Node[]) {
  const palette = useNodeTypes();
  const paletteKeys = new Set((palette.data ?? []).map((node) => node.key));
  const missing = [
    ...new Set(
      nodes.flatMap((node) =>
        typeof node.data.key === "string" ? [node.data.key] : [],
      ),
    ),
  ]
    .filter((key) => !paletteKeys.has(key))
    .sort();
  const metadata = useNodeMetadata(palette.data ? missing : []);
  const data = useMemo(() => {
    // Metadata supplies editing schemas; only the palette response authorizes adding nodes.
    const merged = new Map(
      (metadata.data ?? []).map((node) => [
        node.key,
        { ...node, isCatalogVisible: false },
      ]),
    );
    for (const node of palette.data ?? [])
      merged.set(node.key, { ...node, isCatalogVisible: true });
    return [...merged.values()];
  }, [palette.data, metadata.data]);
  return {
    data,
    isLoading: palette.isLoading || metadata.isLoading,
    error: palette.error ?? metadata.error,
    refetch: async () => {
      await Promise.all([
        palette.refetch(),
        ...(missing.length ? [metadata.refetch()] : []),
      ]);
    },
  };
}
