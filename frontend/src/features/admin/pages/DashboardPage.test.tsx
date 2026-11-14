import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../services/admin.service';
import type { Dashboard } from '../types/admin.types';
import { DashboardPage } from './DashboardPage';

vi.mock('../services/admin.service', () => ({ adminService: { dashboard: vi.fn() } }));
const empty: Dashboard = { updatedAt: '2026-11-14T00:00:00Z', from: '2026-11-07T00:00:00Z', to: '2026-11-14T00:00:00Z', timezone: 'UTC', users: { total: 0, clientsActive: 0, clientsInactive: 0, adminsActive: 0 }, workflows: { total: 0, active: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 }, executions: { SUCCESS: 0, FAILED: 0, CANCELLED: 0, RUNNING: 0, QUEUED: 0 }, successRate: null, errors: [], trend: [] };
let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>);
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(adminService.dashboard).mockResolvedValue(empty); });
afterEach(() => { cleanup(); client.clear(); });
describe('Admin dashboard', () => {
  it('shows no-data success rate and empty trend without inventing 0%', async () => {
    mount();
    expect(await screen.findByText('No data')).toBeTruthy();
    expect(screen.getByText('No executions in the selected date range.')).toBeTruthy();
    expect(screen.queryByText('0.0%')).toBeNull();
    expect(screen.getByText(/Accounts and workflows show current totals/)).toBeTruthy();
  });
  it('retries a failed aggregate request', async () => {
    vi.mocked(adminService.dashboard).mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue(empty);
    mount();
    expect(await screen.findByText('Could not load the dashboard. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('No data')).toBeTruthy();
  });
  it('rejects custom ranges over 90 days without querying them', async () => {
    mount();
    await screen.findByText('No data');
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01T00:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-14T00:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
    expect(screen.getByText('Choose a valid date range of up to 90 days.')).toBeTruthy();
    expect(adminService.dashboard).toHaveBeenCalledTimes(1);
  });
});
