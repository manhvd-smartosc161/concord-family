'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { setToken } from '@/lib/api-client';
import { acceptInvitation, getInvitation } from '@/features/families/api';
import { useAuth } from '@/features/auth/hooks';
import type { InvitationPreview } from '@/features/families/types';

export default function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const t = useTranslations('invite');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { token } = use(params);
  const router = useRouter();
  const { state: auth } = useAuth(false);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    void getInvitation(token)
      .then(setPreview)
      .catch((e) =>
        setError(e instanceof Error ? e.message : t('invalid_link')),
      );
  }, [token]);

  useEffect(() => {
    if (auth.status !== 'authed' || !preview || accepting) return;
    if (auth.user.familyId) {
      setError(t('already_in_family'));
      return;
    }
    setAccepting(true);
    void acceptInvitation(token)
      .then((r) => {
        setToken(r.accessToken);
        window.location.assign('/dashboard');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t('accept_failed'));
        setAccepting(false);
      });
  }, [auth, preview, token, accepting, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-6">
          <div className="text-base font-semibold text-rose-900 dark:text-rose-300">
            ⚠️ {error}
          </div>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            ← {t('back_to_login')}
          </Link>
        </div>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {tCommon('loading')}
      </main>
    );
  }

  if (auth.status === 'unauthed') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            ✉️ {t('title')}
          </h1>
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-300">
            <strong>{preview.inviter.name}</strong> {t('invite_verb')} <strong>{preview.family.name}</strong>.
          </div>
          <p className="text-xs text-muted-foreground">
            {t('login_or_register')}
          </p>
          <div className="flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-center text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              {tAuth('login_title')}
            </Link>
            <Link
              href={`/register?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-800"
            >
              {tAuth('register_link')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {t('processing')}
    </main>
  );
}
