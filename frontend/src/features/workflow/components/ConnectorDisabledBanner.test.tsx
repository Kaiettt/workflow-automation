import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectorDisabledBanner } from './ConnectorDisabledBanner';

describe('ConnectorDisabledBanner (BDD-CM-10)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders alert banner with title and explanation', () => {
    render(<ConnectorDisabledBanner connectorName="Slack" />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(/Tạm ngưng cấp kết nối mới/i)).toBeDefined();
    expect(screen.getByText('Slack')).toBeDefined();
    expect(
      screen.getByText(
        /Các kết nối đã tạo trước đó vẫn tiếp tục hoạt động bình thường/i,
      ),
    ).toBeDefined();
  });

  it('renders generic message when connector name is omitted', () => {
    render(<ConnectorDisabledBanner />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(/dịch vụ này/i)).toBeDefined();
  });
});
