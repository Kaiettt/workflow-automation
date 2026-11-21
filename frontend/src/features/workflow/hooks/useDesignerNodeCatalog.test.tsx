import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useDesignerNodeCatalog } from "./useDesignerNodeCatalog";
import { workflowService } from "../services/workflow.service";
import { workflowApi } from "../api/workflow.api";
import type { NodeTypeDefinition } from "../models/workflow.model";
vi.mock("../services/workflow.service", () => ({
  workflowService: { getNodeTypes: vi.fn() },
}));
vi.mock("../api/workflow.api", () => ({
  workflowApi: { getNodeMetadata: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const metadata: NodeTypeDefinition = {
  id: "hidden",
  key: "logic.hidden",
  displayName: "Hidden",
  category: "LOGIC",
  connectorId: null,
  color: null,
  icon: null,
  description: null,
  configSchema: { properties: { rules: {} } },
  isCatalogVisible: false,
};
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
describe("Designer catalog hydration (BDD-NM-02)", () => {
  it("loads hidden metadata separately and keeps it excluded from palette authorization", async () => {
    vi.mocked(workflowService.getNodeTypes).mockResolvedValue([]);
    vi.mocked(workflowApi.getNodeMetadata).mockResolvedValue([
      { ...metadata, isCatalogVisible: true },
    ]);
    const { result } = renderHook(
      () =>
        useDesignerNodeCatalog([
          { id: "n1", data: { key: metadata.key }, position: { x: 0, y: 0 } },
        ]),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0]).toMatchObject({
      isCatalogVisible: false,
      configSchema: metadata.configSchema,
    });
    expect(workflowApi.getNodeMetadata).toHaveBeenCalledWith(
      ["logic.hidden"],
      expect.any(AbortSignal),
    );
  });
  it("hydrates large existing workflows using bounded metadata requests", async () => {
    vi.mocked(workflowService.getNodeTypes).mockResolvedValue([]);
    vi.mocked(workflowApi.getNodeMetadata).mockImplementation(async (keys) =>
      keys.map((key) => ({ ...metadata, key })),
    );
    const nodes = Array.from({ length: 101 }, (_, index) => ({
      id: String(index),
      data: { key: "logic." + index },
      position: { x: 0, y: 0 },
    }));
    const { result } = renderHook(() => useDesignerNodeCatalog(nodes), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.data).toHaveLength(101));
    expect(
      vi
        .mocked(workflowApi.getNodeMetadata)
        .mock.calls.map(([keys]) => keys.length),
    ).toEqual([100, 1]);
  });
});
