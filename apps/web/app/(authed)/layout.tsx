'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileDrawer } from '@/components/ui';
import { listFunds } from '@/features/funds/api';
import type { FundView } from '@/features/funds/types';
import type { AuthUser } from '@/features/auth/types';
import { logout, useAuth } from '@/features/auth/hooks';

interface LayoutCtx {
  user: AuthUser;
  funds: FundView[];
  reloadFunds: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const LayoutContext = createContext<LayoutCtx | null>(null);

export function useAuthedLayout(): LayoutCtx {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useAuthedLayout must be used inside (authed)');
  return ctx;
}

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state: auth, reloadUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [funds, setFunds] = useState<FundView[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reloadFunds = useCallback(async () => {
    try {
      const next = await listFunds();
      setFunds(next);
    } catch {
      /* useAuth will redirect on 401 */
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'authed' && auth.user.familyId) void reloadFunds();
  }, [auth.status, auth, reloadFunds]);

  useEffect(() => {
    if (
      auth.status === 'authed' &&
      !auth.user.familyId &&
      !pathname.startsWith('/family/setup') &&
      !pathname.startsWith('/invite/')
    ) {
      router.replace('/family/setup');
    }
  }, [auth.status, auth, pathname, router]);

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-stone-400">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-sm">Đang xác thực…</span>
        </div>
      </div>
    );
  }
  if (auth.status === 'unauthed') return null;

  if (!auth.user.familyId) {
    return (
      <LayoutContext.Provider value={{ user: auth.user, funds, reloadFunds, reloadUser }}>
        <div className="flex min-h-screen flex-col bg-stone-50">
          <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
                C
              </div>
              <span className="text-sm font-semibold text-stone-800">
                Concord
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-stone-500 sm:inline">
                {auth.user.email}
              </span>
              <button
                type="button"
                onClick={() => logout(router)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Đăng xuất
              </button>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </LayoutContext.Provider>
    );
  }

  return (
    <LayoutContext.Provider value={{ user: auth.user, funds, reloadFunds, reloadUser }}>
      <div className="flex h-screen flex-col lg:hidden">
        <Header
          user={auth.user}
          onLogout={() => logout(router)}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-hidden bg-stone-50">
          {children}
        </main>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <Sidebar funds={funds} onNavigate={() => setDrawerOpen(false)} />
        </MobileDrawer>
      </div>

      <div className="hidden h-screen grid-cols-[280px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)] lg:grid">
        <Header user={auth.user} onLogout={() => logout(router)} />
        <Sidebar funds={funds} />
        <main className="min-h-0 overflow-hidden bg-stone-50">{children}</main>
      </div>
    </LayoutContext.Provider>
  );
}
