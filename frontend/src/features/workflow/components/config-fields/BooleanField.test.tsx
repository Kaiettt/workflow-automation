import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BooleanField } from './BooleanField';

describe('BooleanField', () => {
  afterEach(cleanup);

  it('renders label and hint text', () => {
    render(
      <BooleanField
        id="enable_ssl"
        label="Enable SSL"
        value={true}
        hint="Validate SSL certificate on request"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Enable SSL')).toBeTruthy();
    expect(screen.getByText('Validate SSL certificate on request')).toBeTruthy();
  });

  it('calls onChange callback when switch is toggled', () => {
    const onChange = vi.fn();
    render(
      <BooleanField
        id="active_mode"
        label="Active Mode"
        value={false}
        onChange={onChange}
      />,
    );

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
