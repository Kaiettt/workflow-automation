import React, { useState, useEffect } from 'react';
import { X, Workflow } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register' | 'forgot-password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'login',
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot-password'>(defaultTab);
  const [prevDefaultTab, setPrevDefaultTab] = useState(defaultTab);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (defaultTab !== prevDefaultTab || isOpen !== prevIsOpen) {
    setPrevDefaultTab(defaultTab);
    setPrevIsOpen(isOpen);
    setTab(defaultTab);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl transition-all animate-in zoom-in-95 duration-200 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
              <Workflow className="size-4" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-foreground">FlowPilot</span>
              <span className="text-xs text-muted-foreground ml-1.5">Access</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab switchers (only visible when in login or register mode) */}
        {tab !== 'forgot-password' ? (
          <div className="mt-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-xs font-medium text-muted-foreground">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`rounded-md py-1.5 transition-colors ${
                tab === 'login'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`rounded-md py-1.5 transition-colors ${
                tab === 'register'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'hover:text-foreground'
              }`}
            >
              Create Account
            </button>
          </div>
        ) : null}

        {/* Content */}
        <div className="mt-5">
          {tab === 'login' && (
            <LoginForm
              onSuccess={onClose}
              onSwitchToRegister={() => setTab('register')}
              onForgotPassword={() => setTab('forgot-password')}
            />
          )}

          {tab === 'register' && (
            <RegisterForm
              onSuccess={onClose}
              onSwitchToLogin={() => setTab('login')}
            />
          )}

          {tab === 'forgot-password' && (
            <ForgotPasswordForm
              onSuccess={onClose}
              onBackToLogin={() => setTab('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
