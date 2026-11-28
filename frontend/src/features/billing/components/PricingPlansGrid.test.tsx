import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PricingPlansGrid } from './PricingPlansGrid';

describe('PricingPlansGrid', () => {
  it('labels the current plan and routes lower and higher plans to their actions', () => {
    const onCheckout = vi.fn();
    const onDowngrade = vi.fn();
    const plans = [
      { id: 'free', code: 'FREE' as const, name: 'Free', priceVnd: 0, monthlyQuota: 100, isActive: true },
      { id: 'pro', code: 'PRO' as const, name: 'Pro', priceVnd: 299000, monthlyQuota: 1000, isActive: true },
      { id: 'business', code: 'BUSINESS' as const, name: 'Business', priceVnd: 599000, monthlyQuota: 5000, isActive: true },
    ];
    render(<PricingPlansGrid plans={plans} subscription={{
      id: 'sub-1', status: 'ACTIVE', currentPeriodStart: '2026-11-01', currentPeriodEnd: '2026-12-01', nextPlanId: null, autoRenew: true,
      plan: plans[1], usage: null,
    }} busy={false} onCheckout={onCheckout} onDowngrade={onDowngrade} />);

    expect(screen.getByRole('button', { name: 'Current plan' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schedule downgrade' }));
    expect(onCheckout).toHaveBeenCalledWith(plans[2]);
    expect(onDowngrade).toHaveBeenCalledWith(plans[0]);
  });
});
