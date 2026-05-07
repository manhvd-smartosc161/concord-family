'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, clearToken, getToken, me, type AuthUser } from './api';

export type AuthState =
  | { status: 'loading' }
  | { status: 'authed'; user: AuthUser }
  | { status: 'unauthed' };

/**
 * Boots the auth state on the client:
 * 1. If no token → unauthed.
 * 2. If token exists → fetch /api/auth/me to verify.
 * 3. On 401 → clear stale token, redirect to /login.
 *
 * Use inside a client layout that wraps protected pages.
 */
export function useAuth(redirectIfUnauthed = true): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState({ status: 'unauthed' });
      if (redirectIfUnauthed) router.replace('/login');
      return;
    }

    let cancelled = false;
    me()
      .then((user) => {
        if (!cancelled) setState({ status: 'authed', user });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
        }
        setState({ status: 'unauthed' });
        if (redirectIfUnauthed) router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, [redirectIfUnauthed, router]);

  return state;
}

export function logout(router: ReturnType<typeof useRouter>): void {
  clearToken();
  router.replace('/login');
}
