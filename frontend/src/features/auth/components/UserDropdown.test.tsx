import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/auth.store';
import { UserDropdown } from './UserDropdown';

describe('UserDropdown', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  afterEach(cleanup);

  it('renders nothing when user is not authenticated', () => {
    const { container } = render(<UserDropdown />);
    expect(container.firstChild).toBeNull();
  });

  it('renders user name and Client role when authenticated', () => {
    useAuthStore.getState().login('token', 'refresh', {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'CLIENT',
    });

    render(<UserDropdown />);

    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('Client')).toBeTruthy();
  });

  it('opens the Admin menu and logs out', async () => {
    useAuthStore.getState().login('token', 'refresh', {
      id: '1',
      name: 'Alice Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    });

    render(<UserDropdown />);

    // Initially dropdown details are hidden
    expect(screen.queryByText('Log out')).toBeNull();

    // Click trigger button
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });

    // Menu opens
    expect(await screen.findByText('admin@example.com')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Platform administration' })).toBeTruthy();

    // Click logout
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

