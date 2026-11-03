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

  it('renders user name, initials, and role badge when authenticated', () => {
    useAuthStore.getState().login('token', 'refresh', {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'DEVELOPER',
    });

    render(<UserDropdown />);

    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('JD')).toBeTruthy();
    expect(screen.getByText('Dev')).toBeTruthy();
  });

  it('opens dropdown menu and logs out when logout button is clicked', () => {
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
    fireEvent.click(screen.getByRole('button'));

    // Menu opens
    expect(screen.getByText('admin@example.com')).toBeTruthy();
    expect(screen.getByText('Log out')).toBeTruthy();

    // Click logout
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

