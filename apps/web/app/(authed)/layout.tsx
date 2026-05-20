'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileDrawer } from '@/components/ui';
import { listFunds } from '@/features/funds/api';
import type { FundView } from '@/features/funds/types';
import type { AuthUser } from '@/features/auth/types';
import { logout, useAuth } from '@/features/auth/hooks';
import { getMyFamily } from '@/features/families/api';
import type { FamilyView } from '@/features/families/types';

interface LayoutCtx {
  user: AuthUser;
  funds: FundView[];
  family: FamilyView | null;
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
  const tCommon = useTranslations('common');
  const [funds, setFunds] = useState<FundView[]>([]);
  const [family, setFamily] = useState<FamilyView | null>(null);
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
    if (auth.status === 'authed' && auth.user.familyId) {
      void getMyFamily()
        .then((res) => setFamily(res.family))
        .catch(() => {});
    }
  }, [auth.status, auth]);

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
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-sm">{tCommon('loading')}</span>
        </div>
      </div>
    );
  }
  if (auth.status === 'unauthed') return null;

  if (!auth.user.familyId) {
    return (
      <LayoutContext.Provider value={{ user: auth.user, funds, family, reloadFunds, reloadUser }}>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
                C
              </div>
              <span className="text-sm font-semibold text-foreground">
                Concord
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {auth.user.email}
              </span>
              <button
                type="button"
                onClick={() => logout(router)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                {tCommon('logout')}
              </button>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </LayoutContext.Provider>
    );
  }

  return (
    <LayoutContext.Provider value={{ user: auth.user, funds, family, reloadFunds, reloadUser }}>
      <div className="flex h-screen flex-col lg:hidden">
        <Header
          user={auth.user}
          onLogout={() => logout(router)}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-hidden bg-background">
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
        <main className="min-h-0 overflow-hidden bg-background">{children}</main>
      </div>
    </LayoutContext.Provider>
  );
}
