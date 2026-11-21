import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeTypesPage } from "./NodeTypesPage";
import { adminService } from "../services/admin.service";
vi.mock("../services/admin.service", () => ({
  adminService: { nodeTypes: vi.fn(), connectors: vi.fn(), nodeType: vi.fn() },
}));
afterEach(cleanup);
describe("Node types Admin page (BDD-NM-01)", () => {
  it("shows usage and sends category filters to the server", async () => {
    vi.mocked(adminService.connectors).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });
    vi.mocked(adminService.nodeTypes).mockResolvedValue({
      items: [
        {
          id: "node",
          key: "ai.generate",
          displayName: "AI Generate",
          category: "AI",
          icon: null,
          color: null,
          connectorId: null,
          connectorKey: null,
          connectorName: null,
          isCatalogVisible: true,
          isExecutionAllowed: false,
          revision: 1,
          publishedWorkflowCount: 7,
          draftWorkflowCount: 2,
          createdAt: "",
          updatedAt: "",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NodeTypesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Quản lý loại node" }),
    ).toBeTruthy();
    await screen.findByText("AI Generate");
    expect(screen.getByText("7")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Danh mục"), {
      target: { value: "AI" },
    });
    await waitFor(() =>
      expect(adminService.nodeTypes).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "AI", page: 1 }),
        expect.any(AbortSignal),
      ),
    );
  });
});
