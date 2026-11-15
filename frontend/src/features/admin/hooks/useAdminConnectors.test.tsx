import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  useAdminConnectors,
  useChangeConnectorPolicy,
} from './useAdminConnectors';
import { adminService } from '../services/admin.service';

vi.mock('../services/admin.service', () => ({
  adminService: {
    connectors: vi.fn(),
    connector: vi.fn(),
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

describe('useAdminConnectors hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches connector list with provided filter (BDD-CM-01)', async () => {
    const mockData = {
      items: [
        {
          id: 'c1',
          key: 'google',
          name: 'Google',
          authType: 'OAUTH2' as const,
          isActive: true,
          allowNewCredentials: true,
          revision: 1,
          credentialCount: 10,
          workflowCount: 4,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(adminService.connectors).mockResolvedValueOnce(mockData);

    const { result } = renderHook(
      () => useAdminConnectors({ page: 1, pageSize: 20, q: 'google' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].key).toBe('google');
  });

  it('mutates policy and invalidates queries (BDD-CM-02)', async () => {
    const updated = {
      id: 'c1',
      key: 'google',
      name: 'Google',
      authType: 'OAUTH2' as const,
      isActive: true,
      allowNewCredentials: false,
      revision: 2,
      credentialCount: 10,
      workflowCount: 4,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    vi.mocked(adminService.changeConnectorPolicy).mockResolvedValueOnce(
      updated,
    );

    const { result } = renderHook(() => useChangeConnectorPolicy(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'c1',
      payload: {
        allowNewCredentials: false,
        reason: 'Tạm ngưng cấp mới',
        expectedRevision: 1,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminService.changeConnectorPolicy).toHaveBeenCalledWith('c1', {
      allowNewCredentials: false,
      reason: 'Tạm ngưng cấp mới',
      expectedRevision: 1,
    });
  });
});

