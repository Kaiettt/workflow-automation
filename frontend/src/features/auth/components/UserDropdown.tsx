import { ChevronDown, CircleUserRound, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthStore } from '../store/auth.store';

export function UserDropdown() {
  const { user, logout } = useAuthStore();
  if (!user) return null;
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" className="h-8 text-xs" aria-label={`Account menu for ${user.name}`} />}>
    <CircleUserRound className="size-4 sm:hidden" /><span className="hidden max-w-28 truncate sm:inline">{user.name}</span><Badge variant="secondary" className="hidden sm:inline-flex">{user.role === 'ADMIN' ? 'Admin' : 'Client'}</Badge><ChevronDown className="size-3" />
  </DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuGroup><DropdownMenuLabel>{user.name}</DropdownMenuLabel><DropdownMenuItem disabled>{user.email}</DropdownMenuItem><DropdownMenuItem disabled><Shield />Role: {user.role === 'ADMIN' ? 'Admin' : 'Client'}</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator />
    {user.role === 'ADMIN' && <DropdownMenuItem render={<a href="/admin" />}>Platform administration</DropdownMenuItem>}
    <DropdownMenuItem onClick={logout}><LogOut />Log out</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
}
