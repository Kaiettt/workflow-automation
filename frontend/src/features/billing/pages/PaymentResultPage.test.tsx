import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentResultPage } from './PaymentResultPage';

const orderQuery = vi.hoisted(() => vi.fn());
vi.mock('../api/billing.api', () => ({ usePaymentOrder: orderQuery }));

function renderResult(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/billing/payment-result" element={<PaymentResultPage />} /><Route path="/billing" element={<p>Dashboard</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('PaymentResultPage', () => {
  beforeEach(() => orderQuery.mockReset());

  it('confirms success using the order status from the API', () => {
    orderQuery.mockReturnValue({ isPending: false, isError: false, data: { status: 'COMPLETED', orderCode: 'txn-1' } });
    renderResult('/billing/payment-result?txnRef=txn-1&vnp_ResponseCode=24');
    expect(screen.getByText('Payment successful')).toBeTruthy();
    expect(screen.getByText('Order txn-1 is complete.')).toBeTruthy();
  });

  it('does not confirm success from a response code when no order reference is present', () => {
    orderQuery.mockReturnValue({ isPending: false, isError: false, data: undefined });
    renderResult('/billing/payment-result?vnp_ResponseCode=00');
    expect(screen.getByText('Could not verify payment')).toBeTruthy();
    expect(screen.getByText('The payment return did not include an order reference.')).toBeTruthy();
  });
});
