import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, UsersRound, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AccountRoleBadge, AccountStatusBadge } from '@/features/admin/components/AccountBadges';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { PageControls } from '@/features/admin/components/PageControls';
import { QueryFeedback } from '@/features/admin/components/QueryFeedback';
import { useUsers } from '@/features/admin/hooks/useAdmin';
import type { UserFilter } from '@/features/admin/types/admin.types';
import { formatDate, formatDateTime } from '@/features/admin/utils/format';

export function UsersPage() {
  const [filter, setFilter] = useState<UserFilter>({ page: 1, pageSize: 20 });
  const [search, setSearch] = useState('');
  const users = useUsers(filter);
  const hasFilters = Boolean(search || filter.q || filter.role || filter.isActive !== undefined);

  return (
    <>
      <AdminPageHeader title="User management" description="Review accounts, manage access, and view owned workflows." actions={
        users.data && <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs font-normal"><UsersRound className="size-3.5" />{users.data.total.toLocaleString('en-US')} {users.data.total === 1 ? 'account' : 'accounts'}</Badge>
      } />
      <Card className="overflow-hidden shadow-none">
        <form className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 p-4" onSubmit={(event) => {
          event.preventDefault();
          setFilter({ ...filter, page: 1, q: search.trim() || undefined });
        }}>
          <div className="relative min-w-48 flex-1">
            <Label htmlFor="user-search" className="sr-only">Name or email</Label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Search by name or email…" className="h-9 bg-background pl-9 text-xs" />
          </div>
          <Button type="submit" className="h-9 px-4 text-xs">Search</Button>
          <Select value={filter.role ?? 'ALL'} onValueChange={(value) => setFilter({ ...filter, page: 1, role: value === 'ADMIN' || value === 'CLIENT' ? value : undefined })}>
            <SelectTrigger aria-label="Filter by role" className="h-9 w-32 bg-background text-xs"><SelectValue>{filter.role === 'ADMIN' ? 'Admin' : filter.role === 'CLIENT' ? 'Client' : 'All roles'}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All roles</SelectItem><SelectItem value="CLIENT">Client</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
          </Select>
          <Select value={filter.isActive === undefined ? 'ALL' : String(filter.isActive)} onValueChange={(value) => setFilter({ ...filter, page: 1, isActive: value === 'ALL' ? undefined : value === 'true' })}>
            <SelectTrigger aria-label="Filter by status" className="h-9 w-36 bg-background text-xs"><SelectValue>{filter.isActive === undefined ? 'All statuses' : filter.isActive ? 'Active' : 'Suspended'}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="true">Active</SelectItem><SelectItem value="false">Suspended</SelectItem></SelectContent>
          </Select>
          {hasFilters && <Button type="button" variant="ghost" className="h-9 text-xs" onClick={() => { setSearch(''); setFilter({ page: 1, pageSize: 20 }); }}><X className="size-3.5" />Reset filters</Button>}
        </form>
        {(users.isPending || users.isError) && <CardContent className="p-4"><QueryFeedback pending={users.isPending} error={users.isError} loadingText="Loading accounts…" errorText="Could not load accounts." onRetry={() => void users.refetch()} /></CardContent>}
        {users.data && (
          <>
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 text-xs sm:px-5">Account</TableHead><TableHead className="hidden text-xs lg:table-cell">Account ID</TableHead><TableHead className="text-xs">Role</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="hidden text-xs md:table-cell">Created</TableHead><TableHead className="hidden w-16 px-5 sm:table-cell"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.items.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell className="px-3 py-4 sm:px-5">
                      <Link className="block max-w-[calc(100vw-15rem)] truncate text-sm font-medium underline-offset-4 hover:underline sm:max-w-56" title={user.name} to={`/admin/users/${user.id}`}>{user.name}</Link>
                      <p className="mt-1 max-w-[calc(100vw-15rem)] truncate text-xs text-muted-foreground sm:max-w-56" title={user.email}>{user.email}</p>
                      <p className="mt-1 max-w-[calc(100vw-15rem)] truncate font-mono text-[10px] text-muted-foreground sm:max-w-56 lg:hidden" title={user.id}>{user.id}</p>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[11px] text-muted-foreground lg:table-cell">{user.id}</TableCell>
                    <TableCell><AccountRoleBadge role={user.role} /></TableCell>
                    <TableCell><AccountStatusBadge isActive={user.isActive} /></TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell" title={formatDateTime(user.createdAt)}>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="hidden px-5 text-right sm:table-cell"><Button variant="ghost" size="xs" aria-label={`View ${user.name}`} nativeButton={false} render={<Link to={`/admin/users/${user.id}`} />}>View<ArrowRight className="size-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!users.data.items.length && <CardContent className="py-16 text-center"><UsersRound className="mx-auto mb-3 size-8 text-muted-foreground/50" /><p className="text-sm font-medium">No matching accounts</p><p className="mt-2 text-xs text-muted-foreground">Try another search or reset your filters.</p></CardContent>}
            <PageControls page={filter.page} total={users.data.total} pageSize={filter.pageSize} onChange={(page) => setFilter({ ...filter, page })} />
          </>
        )}
      </Card>
    </>
  );
}
