import { act, cleanup, renderHook } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import type { ReactNode } from "react";
import { apiClient } from "@/shared/api/http-client";
import { useAdminExecution, useAdminExecutions } from "./useAdminExecutions";

describe("BDD-EM-07: visible execution polling at the HTTP/browser boundary", () => {
  let client: QueryClient;
  let visibility: DocumentVisibilityState;
  let get: MockInstance<typeof apiClient.get>;
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    focusManager.setFocused(true);
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
      .filter(([url]) => url === "/api/admin/executions")
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
  it("polls list and detail every 30 seconds, resumes immediately and cleans up on unmount", async () => {
    const hook = renderHook(
      () => {
        useAdminExecutions({ page: 1, pageSize: 20 }, 7);
        useAdminExecution("execution-id");
      },
      { wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(get).toHaveBeenCalledTimes(2);
    const firstRange = latestRange();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(get).toHaveBeenCalledTimes(4);
    const nextRange = latestRange();
    expect(
      new Date(nextRange.to).getTime() - new Date(firstRange.to).getTime(),
    ).toBe(30000);
    expect(
      new Date(nextRange.to).getTime() - new Date(nextRange.from).getTime(),
    ).toBe(7 * 86400000);
    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).toHaveBeenCalledTimes(4);
    await act(async () => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(get).toHaveBeenCalledTimes(6);
    hook.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).toHaveBeenCalledTimes(6);
  });
  it("does not request data when mounted in a hidden tab", async () => {
    visibility = "hidden";
    renderHook(() => useAdminExecutions({ page: 1, pageSize: 20 }, 7), {
      wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(get).not.toHaveBeenCalled();
  });
});
