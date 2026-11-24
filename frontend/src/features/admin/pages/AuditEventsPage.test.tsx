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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { apiClient } from "@/shared/api/http-client";
import { AuditEventsPage } from "./AuditEventsPage";
import type { AdminAuditSummary } from "../types/admin-audit.types";

const event: AdminAuditSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  actorType: "ADMIN",
  actorId: "22222222-2222-4222-8222-222222222222",
  actorName: "Le Admin",
  actorEmail: "admin@example.com",
  action: "USER_SUSPENDED",
  targetType: "USER",
  targetId: "33333333-3333-4333-8333-333333333333",
  targetName: "Target account",
  reason: "Maintenance policy change",
  createdAt: "2026-11-24T00:00:00.000Z",
};
const response = (data: unknown) => ({
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
      return response({
        items: [
          { id: event.actorId, name: event.actorName, email: event.actorEmail },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    if (url === "/api/admin/audit-events")
      return response({ items: [event], total: 41, page: 3, pageSize: 20 });
    return response({
      ...event,
      before: { role: "CLIENT", isActive: true, payload: "PRIVATE_SENTINEL" },
      after: {
        role: "CLIENT",
        isActive: false,
        credential: "PRIVATE_SENTINEL",
      },
    });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount(path = "/admin/audit-events?page=3&action=USER_SUSPENDED") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/audit-events" element={<AuditEventsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
describe("Audit viewer at HTTP/UI boundary", () => {
  it("BDD-AL-01/05/06: filters actor UUID, resets page and shows safe historical diff in a read-only dialog", async () => {
    const client = mount();
    await screen.findByText("Maintenance policy change");
    fireEvent.change(screen.getByLabelText("Người thực hiện"), {
      target: { value: event.actorId },
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/api/admin/audit-events",
        expect.objectContaining({
          params: expect.objectContaining({
            actorId: event.actorId,
            page: 1,
            action: "USER_SUSPENDED",
          }),
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Chi tiết " + event.id }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("isActive");
    const changed = within(dialog).getByRole("row", { name: /isActive/ });
    expect(within(changed).getByText("true")).toBeTruthy();
    expect(within(changed).getByText("false")).toBeTruthy();
    expect(changed.getAttribute("data-changed")).toBe("true");
    expect(
      within(dialog)
        .getByRole("row", { name: /role/ })
        .getAttribute("data-changed"),
    ).toBe("false");
    expect(within(dialog).getAllByText("Không ghi nhận")).toHaveLength(2);
    expect(screen.queryByText("PRIVATE_SENTINEL")).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: /sửa|xóa/i }),
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(screen.getByLabelText("Người thực hiện")).toHaveProperty(
      "value",
      event.actorId,
    );
    client.clear();
  });
  it("BDD-AL-04/05: preserves SYSTEM bootstrap with an empty before snapshot", async () => {
    const summary: AdminAuditSummary = {
      ...event,
      actorType: "SYSTEM",
      actorId: null,
      actorName: null,
      actorEmail: null,
      action: "ADMIN_BOOTSTRAPPED",
      targetName: null,
    };
    get.mockImplementation(async (url) =>
      url === "/api/admin/users"
        ? response({ items: [] })
        : url === "/api/admin/audit-events"
          ? response({ items: [summary], total: 1, page: 1, pageSize: 20 })
          : response({
              ...summary,
              before: {},
              after: { role: "ADMIN", isActive: true },
            }),
    );
    const client = mount("/admin/audit-events?eventId=" + event.id);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("role");
    expect(within(dialog).getAllByText("SYSTEM").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("Không ghi nhận")).toHaveLength(2);
    expect(within(dialog).queryByText("revision")).toBeNull();
    client.clear();
  });
  it("BDD-AL-05/06: distinguishes zero from null in stored revisions", async () => {
    const summary: AdminAuditSummary = {
      ...event,
      action: "CONNECTOR_POLICY_CHANGED",
      targetType: "CONNECTOR",
    };
    get.mockImplementation(async (url) =>
      url === "/api/admin/users"
        ? response({ items: [] })
        : url === "/api/admin/audit-events"
          ? response({ items: [summary], total: 1, page: 1, pageSize: 20 })
          : response({
              ...summary,
              before: { allowNewCredentials: true, revision: 0 },
              after: { allowNewCredentials: false, revision: null },
            }),
    );
    const client = mount("/admin/audit-events?eventId=" + event.id);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("revision");
    const row = within(dialog).getByRole("row", { name: /revision/ });
    expect(within(row).getByText("0")).toBeTruthy();
    expect(within(row).getByText("null")).toBeTruthy();
    expect(row.getAttribute("data-changed")).toBe("true");
    client.clear();
  });
  it("BDD-AL-11: retries a failed list read and presents empty results", async () => {
    get.mockRejectedValue(new Error("Unavailable"));
    const client = mount("/admin/audit-events");
    await screen.findByText(
      "Không thể tải nhật ký quản trị. Kiểm tra bộ lọc và quyền truy cập.",
    );
    get.mockResolvedValue(
      response({ items: [], total: 0, page: 1, pageSize: 20 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Không tìm thấy sự kiện quản trị phù hợp.");
    client.clear();
  });
  it("BDD-AL-04/05: keeps unknown records distinct from SYSTEM and hides unsupported snapshots", async () => {
    const summary: AdminAuditSummary = {
      ...event,
      actorType: "UNKNOWN",
      actorId: null,
      actorName: null,
      actorEmail: null,
      action: "UNKNOWN_ACTION",
      targetType: "UNKNOWN",
      targetName: null,
    };
    get.mockImplementation(async (url) =>
      url === "/api/admin/users"
        ? response({ items: [] })
        : url === "/api/admin/audit-events"
          ? response({ items: [summary], total: 1, page: 1, pageSize: 20 })
          : response({
              ...summary,
              before: { role: "PRIVATE_SENTINEL" },
              after: {},
            }),
    );
    const client = mount("/admin/audit-events?eventId=" + event.id);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Không có dữ liệu đối chiếu được hỗ trợ.");
    expect(within(dialog).queryByText("SYSTEM")).toBeNull();
    expect(within(dialog).getByText("Không xác định")).toBeTruthy();
    expect(screen.queryByText("PRIVATE_SENTINEL")).toBeNull();
    client.clear();
  });
  it("BDD-AL-11: shows a missing detail safely and lets the user close the dialog", async () => {
    get.mockImplementation(async (url) => {
      if (url === "/api/admin/users") return response({ items: [] });
      if (url === "/api/admin/audit-events")
        return response({ items: [event], total: 1, page: 1, pageSize: 20 });
      throw {
        isAxiosError: true,
        response: { status: 404, data: { message: "PRIVATE_SENTINEL" } },
      };
    });
    const client = mount("/admin/audit-events?eventId=" + event.id);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Không tìm thấy sự kiện quản trị.");
    expect(screen.queryByText("PRIVATE_SENTINEL")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    client.clear();
  });
  it("BDD-AL-01/03: submits target UUID and page size, and resets page when changing time presets", async () => {
    const client = mount();
    await screen.findByText(event.reason);
    const targetId = "44444444-4444-4444-8444-444444444444";
    fireEvent.change(screen.getByLabelText("Target ID"), {
      target: { value: targetId },
    });
    const form = screen
      .getByRole("button", { name: "Áp dụng ID" })
      .closest("form");
    if (!form) throw new Error("Missing filter form");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/api/admin/audit-events",
        expect.objectContaining({
          params: expect.objectContaining({ targetId, page: 1 }),
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    await screen.findByRole("button", { name: "Chi tiết " + event.id });
    fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), {
      target: { value: "50" },
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/api/admin/audit-events",
        expect.objectContaining({
          params: expect.objectContaining({ targetId, pageSize: 50, page: 1 }),
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "30 days" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    client.clear();
  });
});
