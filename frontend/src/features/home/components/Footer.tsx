import React from 'react';
import { Workflow } from 'lucide-react';

const GithubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
          
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
              <Workflow className="size-3.5" />
            </div>
            <span className="text-sm font-semibold text-foreground">FlowPilot</span>
            <span className="text-xs text-muted-foreground ml-1">
              • Visual Workflow Automation
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a 
              href="https://github.com/Kaiettt/workflow-automation" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GithubIcon className="size-3.5" />
              <span>GitHub</span>
            </a>
            <a href="#templates" className="hover:text-foreground transition-colors">
              Templates
            </a>
            <a href="#canvas" className="hover:text-foreground transition-colors">
              Canvas
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Architecture
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-muted-foreground gap-2">
          <span>FlowPilot Engine • React 19 • NestJS • PostgreSQL</span>
          <span>Open Source Developer Edition</span>
        </div>
      </div>
    </footer>
  );
};
