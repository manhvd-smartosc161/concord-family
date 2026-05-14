'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, setToken } from '@/lib/api-client';
import { login } from '@/features/auth/api';
import { useAuth } from '@/features/auth/hooks';
import { BrandPanel } from '@/features/auth/components/brand-panel';
import { LocaleToggle } from '@/components/layout/locale-toggle';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const { state: auth } = useAuth(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === 'authed') {
      router.replace(next ?? (auth.user.familyId ? '/dashboard' : '/family/setup'));
    }
  }, [auth, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      setToken(res.accessToken);
      if (next) {
        router.replace(next);
      } else if (!res.user.familyId) {
        router.replace('/family/setup');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Đăng nhập thất bại';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      <BrandPanel />

      <MobileBackdrop />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LocaleToggle />
      </div>

      <div className="relative flex min-h-screen flex-col px-5 pb-10 pt-12 sm:px-8 lg:min-h-0 lg:items-center lg:justify-center lg:bg-background lg:px-6 lg:pt-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-bold text-white shadow-lg shadow-emerald-700/25">
              C
            </div>
            <div className="mt-4 text-center">
              <div className="text-lg font-semibold tracking-tight text-foreground">
                Concord
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {t('login_tagline')}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-card/90 p-6 shadow-[0_20px_40px_-20px_rgba(15,42,30,0.15)] ring-1 ring-border/60 backdrop-blur-sm sm:p-7 lg:rounded-2xl lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none">
            <div className="lg:text-left">
              <h1 className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
                {t('login_title')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('login_subtitle')}
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4 lg:mt-8">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="ban@gmail.com"
                  className={inputClass}
                  disabled={submitting}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-medium text-muted-foreground">
                    {t('password')}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-medium text-emerald-700 hover:underline"
                  >
                    {t('forgot_password')}
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={inputClass}
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="mt-2 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-emerald-700/20 transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none lg:rounded-lg lg:py-2.5"
              >
                {submitting ? t('submitting') : t('login_title')}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('no_account')}{' '}
            <Link
              href="/register"
              className="font-medium text-emerald-700 hover:underline"
            >
              {t('register_link')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function MobileBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/70 via-stone-50 to-amber-50/40" />
      <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-input bg-background px-4 py-3 text-sm transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:rounded-lg lg:px-3.5 lg:py-2.5';
