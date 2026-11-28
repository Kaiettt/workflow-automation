import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminBillingPage } from './AdminBillingPage';

const plans = vi.fn();
const subscriptions = vi.fn();
const payments = vi.fn();
const revenue = vi.fn();
vi.mock('./useAdminBilling', () => ({
  useAdminBillingPlans: () => plans(),
  useAdminBillingSubscriptions: () => subscriptions(),
  useAdminBillingPayments: () => payments(),
  useAdminBillingRevenue: () => revenue(),
  useUpdateBillingPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('AdminBillingPage', () => {
  afterEach(cleanup);
  beforeEach(() => {
    plans.mockReturnValue({ data: [], isLoading: false, isError: false });
    subscriptions.mockReturnValue({ data: { items: [], total: 0, page: 1, pageSize: 20 }, isLoading: false, isError: false });
    payments.mockReturnValue({ data: { items: [], total: 0, page: 1, pageSize: 20 }, isLoading: false, isError: false });
    revenue.mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('shows plans by default and lets admins switch to subscription search', () => {
    render(<AdminBillingPage />);
    expect(screen.getByRole('heading', { name: 'Billing management' }).textContent).toBe('Billing management');
    expect(screen.getByRole('tab', { name: 'Plans' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Subscriptions' }));
    expect(screen.getByRole('searchbox', { name: 'Search subscriptions by email' })).toBeTruthy();
  });

  it('shows the completed revenue date range controls', () => {
    render(<AdminBillingPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Revenue' }));
    expect(screen.getByLabelText('From').getAttribute('type')).toBe('date');
    expect(screen.getByLabelText('To').getAttribute('type')).toBe('date');
  });
});
