import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanEditDialog } from './PlanEditDialog';
import type { BillingPlanAdmin } from '../types/admin.types';

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('./useAdminBilling', () => ({
  useUpdateBillingPlan: () => ({ mutateAsync, isPending: false }),
}));

const plan: BillingPlanAdmin = {
  id: 'plan-id', code: 'PRO', name: 'Pro', priceVnd: 299000, monthlyQuota: 300,
  isActive: true, revision: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PlanEditDialog', () => {
  afterEach(() => { cleanup(); mutateAsync.mockReset(); });

  it('submits plan changes with the reason and expected revision', async () => {
    mutateAsync.mockResolvedValue(plan);
    render(<PlanEditDialog plan={plan} open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Price (VND)'), { target: { value: '349000' } });
    fireEvent.change(screen.getByLabelText('Reason (5–500 characters)'), { target: { value: 'Annual pricing update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      id: plan.id,
      payload: {
        priceVnd: 349000, monthlyQuota: 300, isActive: true,
        expectedRevision: plan.revision, reason: 'Annual pricing update',
      },
    }));
  });
});
