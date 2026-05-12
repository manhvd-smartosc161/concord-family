'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, clearToken, getToken } from '@/lib/api-client';
import { me } from '@/features/auth/api';
import type { AuthUser } from '@/features/auth/types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'authed'; user: AuthUser }
  | { status: 'unauthed' };

export function useAuth(redirectIfUnauthed = true): {
  state: AuthState;
  reloadUser: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const redirectRef = useRef(redirectIfUnauthed);
  redirectRef.current = redirectIfUnauthed;

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setState({ status: 'unauthed' });
      if (redirectRef.current) routerRef.current.replace('/login');
      return;
    }
    try {
      const user = await me();
      setState({ status: 'authed', user });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) clearToken();
      setState({ status: 'unauthed' });
      if (redirectRef.current) routerRef.current.replace('/login');
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  return { state, reloadUser: fetchUser };
}

export function logout(router: ReturnType<typeof useRouter>): void {
  clearToken();
  router.replace('/login');
}
