import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { LogOut, ChevronDown, Shield } from 'lucide-react';

export const UserDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as HTMLElement)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const roleLabel =
    user.role === 'ADMIN'
      ? 'Admin'
      : user.role === 'DEVELOPER'
      ? 'Dev'
      : 'User';

  const roleBadgeColor =
    user.role === 'ADMIN'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      : user.role === 'DEVELOPER'
      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
      : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
      >
        <div className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
          {initials}
        </div>
        <span className="hidden sm:inline-block max-w-[100px] truncate">{user.name}</span>
        <span className={`rounded border px-1.5 py-0.2 text-[10px] font-mono ${roleBadgeColor}`}>
          {roleLabel}
        </span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-border bg-card p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 z-50">
          {/* User Profile Header */}
          <div className="px-3 py-2.5 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground truncate">{user.name}</span>
                <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="size-3" />
              <span>Role: <strong className="text-foreground">{user.role}</strong></span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
