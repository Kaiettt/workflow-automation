import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Shield } from 'lucide-react';

import { AppHeader } from '@/components/layout/AppHeader';
import { FlowPilotBrand } from '@/components/layout/FlowPilotBrand';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/features/auth/store/auth.store';

function AdminAccessScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader><FlowPilotBrand /></AppHeader>
      <main className="container mx-auto flex max-w-7xl flex-1 items-start justify-center px-4 py-16 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-none">
          <CardHeader><Shield className="mb-2 size-5 text-muted-foreground" /><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
      </main>
    </div>
  );
}

export function AdminGuard() {
  const token = useAuthStore((state) => state.token);
  const updateUser = useAuthStore((state) => state.updateUser);
  const session = useQuery({ queryKey: ['session', token], queryFn: ({ signal }) => authApi.getMe(signal), enabled: Boolean(token), retry: false, refetchInterval: 30000, refetchIntervalInBackground: false });
  useEffect(() => { if (session.data && token) updateUser(session.data.data); }, [session.data, token, updateUser]);

  if (!token) return <Navigate to="/" replace />;
  if (session.isPending) return <AdminAccessScreen title="Checking Admin access"><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Verifying your session…</p></AdminAccessScreen>;
  if (session.isError) return <AdminAccessScreen title="Could not verify your session"><Alert><AlertDescription>Could not verify your session.</AlertDescription></Alert><Button variant="outline" onClick={() => void session.refetch()}>Try again</Button></AdminAccessScreen>;
  if (!session.data?.data.isActive || session.data.data.role !== 'ADMIN') return <AdminAccessScreen title="Admin access required"><Alert><AlertDescription>You do not have access to the Admin area.</AlertDescription></Alert><Button variant="outline" nativeButton={false} render={<Link to="/" />}>Back to home</Button></AdminAccessScreen>;
  return <Outlet />;
}
