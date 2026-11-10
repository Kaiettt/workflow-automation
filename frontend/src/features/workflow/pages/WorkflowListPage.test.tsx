import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowListPage } from './WorkflowListPage';
import { useWorkflows } from '../hooks/useWorkflows';
import { useWorkflowMutations } from '../hooks/useWorkflowMutations';

vi.mock('../hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));

vi.mock('../hooks/useWorkflowMutations', () => ({
  useWorkflowMutations: vi.fn(),
}));

describe('WorkflowListPage', () => {
  const mockCreateWorkflowMutation = {
    mutate: vi.fn(),
    isPending: false,
  };
  const mockCreateFromTemplateMutation = {
    mutate: vi.fn(),
    isPending: false,
  };
  const mockRenameWorkflowMutation = {
    mutate: vi.fn(),
    isPending: false,
  };
  const mockDeleteWorkflowMutation = {
    mutate: vi.fn(),
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkflowMutations).mockReturnValue({
      createWorkflowMutation: mockCreateWorkflowMutation,
      createFromTemplateMutation: mockCreateFromTemplateMutation,
      renameWorkflowMutation: mockRenameWorkflowMutation,
      deleteWorkflowMutation: mockDeleteWorkflowMutation,
      saveDraftMutation: {},
      publishWorkflowMutation: {},
    } as unknown as ReturnType<typeof useWorkflowMutations>);
  });

  afterEach(cleanup);

  const renderComponent = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <WorkflowListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('renders workflows list correctly', () => {
    vi.mocked(useWorkflows).mockReturnValue({
      data: [
        {
          id: 'wf-1',
          name: 'Customer Onboarding',
          status: 'DRAFT',
          active: false,
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-05T12:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflows>);

    renderComponent();

    expect(screen.getByText('Customer Onboarding')).toBeTruthy();
    expect(screen.getByText('wf-1')).toBeTruthy();
  });

  it('triggers createWorkflowMutation when clicking create button', () => {
    vi.mocked(useWorkflows).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflows>);

    renderComponent();

    const createButtons = screen.getAllByRole('button', {
      name: /Tạo Workflow/i,
    });
    fireEvent.click(createButtons[0]);

    expect(mockCreateWorkflowMutation.mutate).toHaveBeenCalled();
  });

  it('handles rename workflow flow', () => {
    vi.mocked(useWorkflows).mockReturnValue({
      data: [
        {
          id: 'wf-1',
          name: 'My Workflow',
          status: 'DRAFT',
          active: false,
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-05T12:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflows>);

    renderComponent();

    const renameButton = screen.getByRole('button', {
      name: 'Rename My Workflow',
    });
    fireEvent.click(renameButton);

    const input = screen.getByLabelText('Workflow name');
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Updated Workflow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockRenameWorkflowMutation.mutate).toHaveBeenCalledWith(
      { id: 'wf-1', name: 'Updated Workflow' },
      expect.any(Object),
    );
  });

  it('handles delete workflow flow', () => {
    vi.mocked(useWorkflows).mockReturnValue({
      data: [
        {
          id: 'wf-1',
          name: 'My Workflow',
          status: 'DRAFT',
          active: false,
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-05T12:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflows>);

    renderComponent();

    const deleteButton = screen.getByRole('button', {
      name: 'Delete My Workflow',
    });
    fireEvent.click(deleteButton);

    expect(screen.getByText('Delete workflow?')).toBeTruthy();

    const confirmDeleteButton = screen.getByRole('button', {
      name: 'Delete workflow',
    });
    fireEvent.click(confirmDeleteButton);

    expect(mockDeleteWorkflowMutation.mutate).toHaveBeenCalledWith(
      'wf-1',
      expect.any(Object),
    );
  });
});
