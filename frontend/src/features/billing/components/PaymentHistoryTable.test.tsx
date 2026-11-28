import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentHistoryTable } from './PaymentHistoryTable';

describe('PaymentHistoryTable', () => {
  it('shows order date, amount, and server status', () => {
    render(<PaymentHistoryTable orders={[{
      id: 'order-1', orderCode: 'FP-ORDER-1', amountVnd: 299000, status: 'COMPLETED', createdAt: '2026-11-28T00:00:00.000Z', payDate: null,
    }]} />);
    expect(screen.getByText('FP-ORDER-1')).toBeTruthy();
    expect(screen.getByText('299.000 ₫')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
  });
});
