'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { forgotPassword } from '@/features/auth/api';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}

function ForgotPasswordInner() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
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

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-background to-amber-50"
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
          {submitted ? (
            <div className="py-2 text-center">
              <div className="mb-3 text-4xl">📧</div>
              <h2 className="text-base font-semibold text-foreground">
                {t('forgot_email_sent_title')}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('forgot_email_sent_desc')}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm font-medium text-emerald-700 hover:underline"
              >
                ← {t('back_to_login')}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground">
                {t('forgot_title')}
              </h2>
              <p className="mt-1 mb-6 text-xs text-muted-foreground">
                {t('forgot_subtitle')}
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
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
                  disabled={submitting || !email}
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  {submitting ? t('forgot_submitting') : t('forgot_submit')}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                <Link
                  href="/login"
                  className="font-medium text-emerald-700 hover:underline"
                >
                  ← {t('back_to_login')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
