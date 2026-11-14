import type { ReactNode } from 'react';

interface AppHeaderProps {
  children: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </header>
  );
}
