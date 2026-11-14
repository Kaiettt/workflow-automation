import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, LogIn, Shield } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { FlowPilotBrand } from '@/components/layout/FlowPilotBrand';
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
  const role = useAuthStore((state) => state.user?.role);

  return (
    <AppHeader>
        {/* Brand */}
        <div className="flex items-center gap-6">
          <FlowPilotBrand />

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-muted-foreground">
            <Link to="/workflows" className="text-foreground font-semibold hover:text-primary transition-colors flex items-center gap-1">
              <span>Workflows</span>
            </Link>
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
          {isAuthenticated && role === 'ADMIN' && <Button variant="outline" size="sm" aria-label="Admin" nativeButton={false} render={<Link to="/admin" />}><Shield className="size-3.5" /><span className="hidden sm:inline">Admin</span></Button>}
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
            aria-label={loading ? 'Creating...' : 'New Workflow'}
            className="rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-xs px-3 py-1.5 h-8"
          >
            <Plus className="size-3.5 mr-1" />
            <span className="hidden sm:inline">{loading ? 'Creating...' : 'New Workflow'}</span>
            <span className="sm:hidden">{loading ? 'Creating…' : 'New'}</span>
          </Button>
        </div>
    </AppHeader>
  );
};
