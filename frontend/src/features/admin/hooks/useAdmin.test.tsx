import { act, cleanup, renderHook } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { adminService } from '../services/admin.service';
import { useDashboard } from './useAdmin';

vi.mock('../services/admin.service', () => ({ adminService: { dashboard: vi.fn() } }));
let client: QueryClient;
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(adminService.dashboard).mockReset().mockResolvedValue({ updatedAt: '2026-11-14T00:00:00Z', from: '', to: '', timezone: 'UTC', users: { total: 0, clientsActive: 0, clientsInactive: 0, adminsActive: 0 }, workflows: { total: 0, active: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 }, executions: {}, successRate: null, errors: [], trend: [] });
  focusManager.setFocused(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
});
afterEach(() => { cleanup(); client.clear(); focusManager.setFocused(undefined); vi.useRealTimers(); });
describe('Dashboard polling', () => {
  it('polls every 30 seconds only while visible and advances rolling ranges', async () => {
    const filter = { from: '2026-11-07T00:00:00Z', to: '2026-11-14T00:00:00Z', timezone: 'Asia/Ho_Chi_Minh' };
    renderHook(() => useDashboard(filter, 7), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(adminService.dashboard).toHaveBeenCalledTimes(1);
    const first = vi.mocked(adminService.dashboard).mock.calls[0][0];
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(adminService.dashboard).toHaveBeenCalledTimes(2);
    const next = vi.mocked(adminService.dashboard).mock.calls[1][0];
    expect(new Date(next.to).getTime() - new Date(first.to).getTime()).toBe(30000);
    expect(new Date(next.to).getTime() - new Date(next.from).getTime()).toBe(7 * 86400000);
    act(() => focusManager.setFocused(false));
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(adminService.dashboard).toHaveBeenCalledTimes(2);
    act(() => focusManager.setFocused(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(adminService.dashboard).toHaveBeenCalledTimes(3);
  });
});
