'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, setToken } from '@/lib/api-client';
import { login } from '@/features/auth/api';
import { useAuth } from '@/features/auth/hooks';

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-50 px-4 py-12">
      {/* Decorative gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        {/* Logo + tagline */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white shadow-lg shadow-emerald-700/20">
            C
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Concord
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {t('login_tagline')}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-xl shadow-stone-300/30 backdrop-blur sm:p-8">
          <h2 className="text-base font-semibold text-stone-800">
            {t('login_title')}
          </h2>
          <p className="mt-1 mb-6 text-xs text-stone-500">
            {t('login_subtitle')}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="ban@gmail.com"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={submitting}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700">
                  {t('password')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-stone-400 hover:text-emerald-700 hover:underline"
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
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="group relative w-full overflow-hidden rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {submitting ? t('submitting') : t('login_title')}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-stone-500">
            {t('no_account')}{' '}
            <Link href="/register" className="font-medium text-emerald-700 hover:underline">
              {t('register_link')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
