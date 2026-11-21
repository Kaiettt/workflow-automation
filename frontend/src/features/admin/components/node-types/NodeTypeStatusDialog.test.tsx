import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeTypeStatusDialog } from "./NodeTypeStatusDialog";
import { adminService } from "../../services/admin.service";
import type { NodeTypeAdminItem } from "../../types/admin.types";
vi.mock("../../services/admin.service", () => ({
  adminService: { changeNodeTypeStatus: vi.fn(), nodeType: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const node: NodeTypeAdminItem = {
  id: "node",
  key: "logic.if",
  displayName: "If",
  category: "LOGIC",
  icon: null,
  color: null,
  connectorId: null,
  connectorKey: null,
  connectorName: null,
  isCatalogVisible: true,
  isExecutionAllowed: true,
  revision: 2,
  publishedWorkflowCount: 3,
  draftWorkflowCount: 4,
  createdAt: "2026-11-22T00:00:00Z",
  updatedAt: "2026-11-22T00:00:00Z",
};
function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NodeTypeStatusDialog nodeType={node} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, client };
}
describe("Node status dialog (BDD-NM-10)", () => {
  it("reloads a stale policy and retains the reason before retrying (BDD-NM-06/10)", async () => {
    vi.mocked(adminService.changeNodeTypeStatus)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { code: "STALE_REVISION" } },
      })
      .mockResolvedValueOnce({
        nodeTypeKey: node.key,
        isCatalogVisible: false,
        isExecutionAllowed: false,
        revision: 4,
        updatedAt: node.updatedAt,
      });
    vi.mocked(adminService.nodeType).mockResolvedValue({
      ...node,
      revision: 3,
      isExecutionAllowed: false,
      workflows: [],
      configSchema: {},
      inputSchema: null,
      outputSchema: null,
    });
    const { onClose } = renderDialog();
    fireEvent.click(
      screen.getByRole("switch", { name: "Hiển thị trên bảng chọn" }),
    );
    fireEvent.change(screen.getByLabelText("Lý do thay đổi (5–500 ký tự)"), {
      target: { value: "Maintenance window" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByRole("alert");
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "Lưu thay đổi" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại chính sách" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(
      screen.getByLabelText("Lý do thay đổi (5–500 ký tự)").getAttribute("id"),
    ).toBe("node-policy-reason");
    expect(screen.getByDisplayValue("Maintenance window")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("switch", { name: "Hiển thị trên bảng chọn" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(adminService.changeNodeTypeStatus).toHaveBeenLastCalledWith(
      node.key,
      {
        isCatalogVisible: false,
        isExecutionAllowed: false,
        reason: "Maintenance window",
        expectedRevision: 3,
      },
    );
  });
  it("requires a reason and sends both policies with the observed revision", async () => {
    vi.mocked(adminService.changeNodeTypeStatus).mockResolvedValue({
      nodeTypeKey: node.key,
      isCatalogVisible: true,
      isExecutionAllowed: false,
      revision: 3,
      updatedAt: node.updatedAt,
    });
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("switch", { name: "Cho phép thực thi" }));
    expect(
      screen
        .getByRole("button", { name: "Lưu thay đổi" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Lý do thay đổi (5–500 ký tự)"), {
      target: { value: "  Maintenance window  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(adminService.changeNodeTypeStatus).toHaveBeenCalledWith(node.key, {
      isCatalogVisible: true,
      isExecutionAllowed: false,
      expectedRevision: 2,
      reason: "Maintenance window",
    });
  });
});
