import { act, cleanup, renderHook } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import type { ReactNode } from "react";
import { apiClient } from "@/shared/api/http-client";
import { useAdminAudit, useAdminAuditEvent } from "./useAdminAudit";

describe("BDD-AL-12: audit lifecycle at HTTP/browser boundary", () => {
  let client: QueryClient;
  let visibility: DocumentVisibilityState;
  let get: MockInstance<typeof apiClient.get>;
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    focusManager.setFocused(true);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    get = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({
        data: {
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    cleanup();
    client.clear();
    focusManager.setFocused(undefined);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  function latestRange() {
    const params: unknown = get.mock.calls
      .filter(([url]) => url === "/api/admin/audit-events")
      .at(-1)?.[1]?.params;
    if (
      !params ||
      typeof params !== "object" ||
      !("from" in params) ||
      !("to" in params) ||
      typeof params.from !== "string" ||
      typeof params.to !== "string"
    )
      throw new Error("Missing rolling range");
    return { from: params.from, to: params.to };
  }
  it("polls list at 30 seconds only when visible while detail loads on open and cleans up", async () => {
    const hook = renderHook(
      () => {
        useAdminAudit({ page: 1, pageSize: 20 }, 7);
        useAdminAuditEvent("audit-id");
      },
      { wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const initial = latestRange();
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(get).toHaveBeenCalledTimes(3);
    const next = latestRange();
    expect(new Date(next.to).getTime() - new Date(initial.to).getTime()).toBe(
      30000,
    );
    expect(new Date(next.to).getTime() - new Date(next.from).getTime()).toBe(
      604800000,
    );
    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).toHaveBeenCalledTimes(3);
    await act(async () => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(get).toHaveBeenCalledTimes(4);
    expect(
      get.mock.calls.filter(([url]) => url.endsWith("/audit-id")),
    ).toHaveLength(1);
    hook.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).toHaveBeenCalledTimes(4);
  });
  it("does not request list data when mounted hidden", async () => {
    visibility = "hidden";
    renderHook(() => useAdminAudit({ page: 1, pageSize: 20 }, 7), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).not.toHaveBeenCalled();
  });
});
