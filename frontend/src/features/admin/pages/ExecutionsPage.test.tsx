import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { apiClient } from "@/shared/api/http-client";
import { ExecutionsPage } from "./ExecutionsPage";
import { ExecutionDetailPage } from "./ExecutionDetailPage";
import type { AdminExecutionSummary } from "../types/admin-execution.types";

const execution: AdminExecutionSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  workflowId: "22222222-2222-4222-8222-222222222222",
  workflowName: "Order workflow",
  ownerId: "33333333-3333-4333-8333-333333333333",
  ownerName: "Client",
  ownerEmail: "client@example.com",
  versionId: "44444444-4444-4444-8444-444444444444",
  versionNumber: 3,
  status: "FAILED",
  triggerType: "WEBHOOK",
  queuedAt: "2026-11-24T00:00:00Z",
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  errorCode: "UNCLASSIFIED_ERROR",
  cancellationReason: null,
};
const httpResponse = (data: unknown) => ({
  data: { success: true, data },
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
let get: MockInstance<typeof apiClient.get>;
beforeEach(() => {
  get = vi.spyOn(apiClient, "get").mockImplementation(async (url) => {
    if (url === "/api/admin/users")
      return httpResponse({
        items: [
          {
            id: execution.ownerId,
            name: execution.ownerName,
            email: execution.ownerEmail,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    if (url === "/api/admin/executions")
      return httpResponse({
        items: [execution],
        total: 41,
        page: 3,
        pageSize: 20,
      });
    return httpResponse({
      ...execution,
      nodeLogs: [
        {
          nodeId: "trigger",
          nodeKey: "trigger.webhook",
          status: "SUCCESS",
          startedAt: execution.queuedAt,
          finishedAt: execution.queuedAt,
          durationMs: 0,
          retryCount: 0,
          errorCode: null,
        },
        {
          nodeId: "http",
          nodeKey: "integration.http",
          status: "TIMEOUT",
          startedAt: execution.queuedAt,
          finishedAt: null,
          durationMs: null,
          retryCount: 3,
          errorCode: "UNCLASSIFIED_ERROR",
        },
      ],
    });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/executions" element={<ExecutionsPage />} />
          <Route
            path="/admin/executions/:id"
            element={<ExecutionDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
describe("Admin execution UI at HTTP boundary", () => {
  it("BDD-EM-10: filters by owner UUID, resets page and keeps filters when returning from detail", async () => {
    const client = mount("/admin/executions?page=3&status=FAILED");
    await screen.findByText("Order workflow");
    fireEvent.change(screen.getByLabelText("Chủ sở hữu"), {
      target: { value: execution.ownerId },
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/api/admin/executions",
        expect.objectContaining({
          params: expect.objectContaining({
            ownerId: execution.ownerId,
            status: "FAILED",
            page: 1,
          }),
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    const link = await screen.findByRole("link", { name: execution.id });
    expect(link.getAttribute("href")).toContain("ownerId=" + execution.ownerId);
    fireEvent.click(link);
    await screen.findByText("integration.http");
    fireEvent.click(screen.getByRole("link", { name: "Danh sách execution" }));
    await screen.findByText("Order workflow");
    expect(screen.getByLabelText("Chủ sở hữu")).toHaveProperty(
      "value",
      execution.ownerId,
    );
    expect(
      screen.queryByRole("button", { name: /^(Run|Retry|Cancel)$/i }),
    ).toBeNull();
    client.clear();
  });
  it("BDD-EM-06: shows null timing, genuine zero duration and stored retry counts in a read-only detail", async () => {
    const client = mount("/admin/executions/" + execution.id);
    await screen.findByText("integration.http");
    expect(screen.getByText("0 ms")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("Hết thời gian")).toBeTruthy();
    const timeoutRow = screen.getByRole("row", { name: /integration.http/ });
    expect(within(timeoutRow).getByText("3")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /^(Run|Retry|Cancel)$/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: /canvas|chỉnh sửa/i }),
    ).toBeNull();
    client.clear();
  });
  it("BDD-EM-09: presents empty results and retries a failed read", async () => {
    get.mockRejectedValue(new Error("Network unavailable"));
    const client = mount("/admin/executions");
    await screen.findByText(
      "Không thể tải execution. Kiểm tra bộ lọc và quyền truy cập.",
    );
    get.mockResolvedValue(
      httpResponse({ items: [], total: 0, page: 1, pageSize: 20 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Không tìm thấy execution phù hợp.");
    client.clear();
  });
  it("BDD-EM-09: reports a missing execution without exposing server error details", async () => {
    get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { message: "PRIVATE_SENTINEL" } },
    });
    const client = mount("/admin/executions/" + execution.id);
    await screen.findByText("Không tìm thấy lượt thực thi.");
    expect(screen.queryByText("PRIVATE_SENTINEL")).toBeNull();
    client.clear();
  });
});
