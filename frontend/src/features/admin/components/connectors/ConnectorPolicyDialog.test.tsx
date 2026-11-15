/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ConnectorPolicyDialog } from './ConnectorPolicyDialog';
import { adminService } from '../../services/admin.service';
import type { ConnectorAdminItem } from '../../types/admin.types';

vi.mock('../../services/admin.service', () => ({
  adminService: {
    changeConnectorPolicy: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockConnector: ConnectorAdminItem = {
  id: 'conn-1',
  key: 'slack',
  name: 'Slack',
  authType: 'API_KEY',
  isActive: true,
  allowNewCredentials: true,
  revision: 3,
  credentialCount: 8,
  workflowCount: 3,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('ConnectorPolicyDialog (BDD-CM-02, BDD-CM-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders dialog with connector name and switch (BDD-CM-02)', () => {
    render(
      <ConnectorPolicyDialog
        connector={mockConnector}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/Điều chỉnh chính sách kết nối/i)).toBeDefined();
    expect(screen.getByText('Slack')).toBeDefined();
    expect(screen.getByRole('switch')).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: /Xác nhận thay đổi/i })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('enforces reason between 5 and 500 chars and submits policy change (BDD-CM-02)', async () => {
    vi.mocked(adminService.changeConnectorPolicy).mockResolvedValueOnce({
      ...mockConnector,
      allowNewCredentials: false,
      revision: 4,
    });

    const onClose = vi.fn();
    render(
      <ConnectorPolicyDialog
        connector={mockConnector}
        open={true}
        onClose={onClose}
      />,
      { wrapper: createWrapper() },
    );

    // Toggle switch to false
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    // Submit button still disabled without valid reason (reason < 5 chars)
    const textarea = screen.getByPlaceholderText(
      /Nhập lý do thay đổi chính sách/i,
    );
    fireEvent.change(textarea, { target: { value: 'abc' } });
    const submitBtn = screen.getByRole('button', {
      name: /Xác nhận thay đổi/i,
    });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // Enter valid reason (>= 5 chars)
    fireEvent.change(textarea, {
      target: { value: 'Tạm ngưng cấp kết nối mới để bảo trì hệ thống' },
    });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    // Click submit
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminService.changeConnectorPolicy).toHaveBeenCalledWith(
        'conn-1',
        {
          allowNewCredentials: false,
          reason: 'Tạm ngưng cấp kết nối mới để bảo trì hệ thống',
          expectedRevision: 3,
        },
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays error message on STALE_REVISION 409 conflict (BDD-CM-03)', async () => {
    const error: any = new Error('Conflict');
    error.response = { data: { code: 'STALE_REVISION' } };
    vi.mocked(adminService.changeConnectorPolicy).mockRejectedValue(error);

    render(
      <ConnectorPolicyDialog
        connector={mockConnector}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    // Toggle switch
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    // Enter reason
    const textarea = screen.getByPlaceholderText(
      /Nhập lý do thay đổi chính sách/i,
    );
    fireEvent.change(textarea, { target: { value: 'Lý do hợp lệ để submit' } });

    // Submit
    const submitBtn = screen.getByRole('button', {
      name: /Xác nhận thay đổi/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Chính sách đã bị thay đổi bởi quản trị viên khác/i),
      ).toBeDefined();
    });
  });
});
