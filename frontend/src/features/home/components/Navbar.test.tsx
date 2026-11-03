import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/features/auth';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  afterEach(cleanup);

  it('renders brand and navigation links', () => {
    render(
      <MemoryRouter>
        <Navbar onCreateWorkflow={vi.fn()} onOpenAuthModal={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('FlowPilot')).toBeTruthy();
    expect(screen.getByText('Workflows')).toBeTruthy();
    expect(screen.getByText('Templates')).toBeTruthy();
    expect(screen.getByText('Architecture')).toBeTruthy();
  });

  it('renders Sign In button when unauthenticated and triggers onOpenAuthModal', () => {
    const onOpenAuthModal = vi.fn();
    render(
      <MemoryRouter>
        <Navbar onCreateWorkflow={vi.fn()} onOpenAuthModal={onOpenAuthModal} />
      </MemoryRouter>,
    );

    const signInButton = screen.getByRole('button', { name: 'Sign In' });
    expect(signInButton).toBeTruthy();

    fireEvent.click(signInButton);
    expect(onOpenAuthModal).toHaveBeenCalledWith('login');
  });

  it('renders UserDropdown when authenticated', () => {
    useAuthStore.getState().login('token', 'refresh', {
      id: 'user-1',
      name: 'Developer Bob',
      email: 'bob@example.com',
      role: 'DEVELOPER',
    });

    render(
      <MemoryRouter>
        <Navbar onCreateWorkflow={vi.fn()} onOpenAuthModal={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
    expect(screen.getByText('Developer Bob')).toBeTruthy();
  });

  it('calls onCreateWorkflow and shows loading state when button is clicked', () => {
    const onCreateWorkflow = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <Navbar onCreateWorkflow={onCreateWorkflow} onOpenAuthModal={vi.fn()} loading={false} />
      </MemoryRouter>,
    );

    const newWorkflowButton = screen.getByRole('button', { name: 'New Workflow' });
    fireEvent.click(newWorkflowButton);
    expect(onCreateWorkflow).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <Navbar onCreateWorkflow={onCreateWorkflow} onOpenAuthModal={vi.fn()} loading={true} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Creating...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Creating...' }).hasAttribute('disabled')).toBe(true);
  });
});

