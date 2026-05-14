'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { resetPassword } from '@/features/auth/api';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shell = (children: React.ReactNode) => (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
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
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white shadow-lg shadow-emerald-700/20">
            C
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Concord
          </h1>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl shadow-border/30 backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );

  if (!token) {
    return shell(
      <div className="py-2 text-center">
        <div className="mb-3 text-4xl">⚠️</div>
        <h2 className="text-base font-semibold text-foreground">
          {t('reset_invalid_link')}
        </h2>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          ← {t('forgot_title')}
        </Link>
      </div>,
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError(t('pw_min_chars'));
      return;
    }
    if (newPassword !== confirm) {
      setError(t('pw_mismatch'));
      return;
    }
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.replace('/login'), 2000);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('reset_failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return shell(
      <div className="py-2 text-center">
        <div className="mb-3 text-4xl">✅</div>
        <h2 className="text-base font-semibold text-foreground">
          {t('reset_success_title')}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">{t('reset_success_desc')}</p>
      </div>,
    );
  }

  return shell(
    <>
      <h2 className="text-base font-semibold text-foreground">
        {t('reset_title')}
      </h2>
      <p className="mt-1 mb-6 text-xs text-muted-foreground">{t('reset_subtitle')}</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t('new_password')}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
            placeholder="••••••••"
            className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t('confirm_password')}
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
          disabled={submitting || !newPassword || !confirm}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {submitting ? t('reset_submitting') : t('reset_submit')}
        </button>
      </form>
    </>,
  );
}
