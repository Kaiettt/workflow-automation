import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuotaUsageCard } from './QuotaUsageCard';
import type { CurrentSubscription } from '../types/billing.types';

const subscription: CurrentSubscription = {
  id: 'sub-1', status: 'ACTIVE', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z', nextPlanId: null, autoRenew: true,
  plan: { id: 'plan-pro', code: 'PRO', name: 'Pro', priceVnd: 299000, monthlyQuota: 1000, isActive: true },
  usage: { totalQuota: 1000, usedQuota: 245, manualUsage: 100, webhookUsage: 90, scheduleUsage: 55 },
};

describe('QuotaUsageCard', () => {
  it('shows current plan, quota remaining, dates, and trigger usage', () => {
    render(<QuotaUsageCard subscription={subscription} />);
    expect(screen.getByText('Current plan: Pro')).toBeTruthy();
    expect(screen.getByText('755 runs remaining')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('245');
  });
});
