import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function AuthCacheBoundary() {
  const client = useQueryClient();
  useEffect(() => useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id || (!state.token && previous.token)) {
      void client.cancelQueries();
      client.clear();
    }
  }), [client]);
  return null;
}
