import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

describe('PasswordStrengthMeter', () => {
  afterEach(cleanup);

  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('displays "Weak" when only 1 criterion is met', () => {
    render(<PasswordStrengthMeter password="abcdefgh" />);
    expect(screen.getByText('Weak')).toBeTruthy();
    expect(screen.getByText('Password strength:')).toBeTruthy();
  });

  it('displays "Fair" when 2 criteria are met', () => {
    render(<PasswordStrengthMeter password="abcdefgh1" />);
    expect(screen.getByText('Fair')).toBeTruthy();
  });

  it('displays "Good" when 3 criteria are met', () => {
    render(<PasswordStrengthMeter password="Abcdefgh1" />);
    expect(screen.getByText('Good')).toBeTruthy();
  });

  it('displays "Strong" when all 4 criteria are met', () => {
    render(<PasswordStrengthMeter password="Abcdefgh1!" />);
    expect(screen.getByText('Strong')).toBeTruthy();
  });

  it('renders all 4 requirement items in the checklist', () => {
    render(<PasswordStrengthMeter password="test" />);
    expect(screen.getByText('Min 8 chars')).toBeTruthy();
    expect(screen.getByText('Upper & lower')).toBeTruthy();
    expect(screen.getByText('At least 1 number')).toBeTruthy();
    expect(screen.getByText('Special char (!@#$)')).toBeTruthy();
  });
});

