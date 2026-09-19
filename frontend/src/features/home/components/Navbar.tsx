import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Workflow, LogIn } from 'lucide-react';
import { useAuthStore, UserDropdown } from '@/features/auth';

const GithubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface NavbarProps {
  onCreateWorkflow: () => void;
  onOpenAuthModal: (tab?: 'login' | 'register') => void;
  loading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onCreateWorkflow, onOpenAuthModal, loading }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5 font-semibold text-foreground">
            <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
              <Workflow className="size-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">FlowPilot</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              v1.0
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-muted-foreground">
            <a href="#templates" className="hover:text-foreground transition-colors">
              Templates
            </a>
            <a href="#canvas" className="hover:text-foreground transition-colors">
              Canvas
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Architecture
            </a>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Kaiettt/workflow-automation"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <GithubIcon className="size-3.5" />
            <span>GitHub</span>
          </a>

          {isAuthenticated ? (
            <UserDropdown />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenAuthModal('login')}
              className="rounded-lg border-border text-xs font-medium px-3 py-1.5 h-8 gap-1.5"
            >
              <LogIn className="size-3.5" />
              <span>Sign In</span>
            </Button>
          )}

          <Button
            onClick={onCreateWorkflow}
            disabled={loading}
            size="sm"
            className="rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-xs px-3 py-1.5 h-8"
          >
            <Plus className="size-3.5 mr-1" />
            <span>{loading ? 'Creating...' : 'New Workflow'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
