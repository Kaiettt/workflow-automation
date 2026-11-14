import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Shield, UsersRound } from 'lucide-react';

import { AppHeader } from '@/components/layout/AppHeader';
import { FlowPilotBrand } from '@/components/layout/FlowPilotBrand';
import { Button } from '@/components/ui/button';
import { UserDropdown } from '@/features/auth';
import { cn } from '@/lib/utils';

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader>
        <div className="flex items-center gap-4 sm:gap-6">
          <FlowPilotBrand />
          <span className="hidden text-sm text-muted-foreground/40 sm:inline">/</span>
          <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            <Shield className="size-3.5" /> Admin
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className="h-8 text-xs" aria-label="Back to workspace" nativeButton={false} render={<Link to="/workflows" />}>
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back to workspace</span>
          </Button>
          <UserDropdown />
        </div>
      </AppHeader>

      <div className="border-b border-border bg-muted/20">
        <nav aria-label="Admin navigation" className="container mx-auto flex max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          {[{ to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/admin/users', label: 'Users', icon: UsersRound, end: false }].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn('inline-flex items-center gap-2 border-b-2 py-3.5 text-xs font-medium transition-colors', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <item.icon className="size-3.5" /> {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="container mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:space-y-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
          <span>FlowPilot <span className="mx-1.5 text-border">/</span> Platform administration</span>
          <span>Visual workflow automation</span>
        </div>
      </footer>
    </div>
  );
}
