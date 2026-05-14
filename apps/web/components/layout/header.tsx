'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import type { AuthUser } from '@/features/auth/types';
import { LocaleToggle } from './locale-toggle';
import { ThemeToggle } from './theme-toggle';

export function Header({
  user,
  onLogout,
  onMenuClick,
}: {
  user: AuthUser;
  onLogout: () => void;
  onMenuClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tNav = useTranslations('nav');
  return (
    <header className="relative z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur sm:px-4 lg:col-span-2 lg:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-base font-bold text-white shadow-sm shadow-emerald-700/20">
          C
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">Concord</div>
          <div className="text-[11px] text-muted-foreground">Couple finance agent</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />
        <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted"
        >
          <UserAvatar user={user} size={32} />
          <div className="hidden text-left leading-tight sm:block">
            <div className="text-sm font-medium text-foreground">
              {user.name}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {user.role === 'husband' ? tAuth('husband') : tAuth('wife')} · {user.email}
            </div>
          </div>
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onPointerDown={() => setOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <span>👤</span> {tNav('profile')}
              </Link>
              <div className="border-t border-border" />
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/60 hover:text-rose-700"
              >
                <span>🚪</span> {tCommon('logout')}
              </button>
            </div>
          </>
        )}
        </div>
      </div>

    </header>
  );
}
