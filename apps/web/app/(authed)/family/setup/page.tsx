'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { setToken } from '@/lib/api-client';
import { acceptInvitation, createFamily } from '@/features/families/api';
import { useAuthedLayout } from '../../layout';

type Mode = 'choose' | 'create' | 'join';

export default function FamilySetupPage() {
  return (
    <Suspense fallback={null}>
      <FamilySetupInner />
    </Suspense>
  );
}

function FamilySetupInner() {
  const t = useTranslations('family');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuthedLayout();
  const weddingPrefill = params.get('wedding') ?? '';

  const [mode, setMode] = useState<Mode>('choose');
  const [familyName, setFamilyName] = useState(
    user.name ? `Gia đình ${user.name}` : '',
  );
  const [weddingDate, setWeddingDate] = useState(weddingPrefill);
  const [token, setTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.familyId) {
      router.replace('/dashboard');
    }
  }, [user.familyId, router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await createFamily({
        name: familyName.trim(),
        weddingDate: weddingDate || undefined,
      });
      setToken(res.accessToken);
      window.location.assign('/family/invite');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tạo gia đình');
    } finally {
      setSubmitting(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const extracted = extractToken(token);
    if (!extracted) {
      setError('Token không hợp lệ. Dán link mời hoặc UUID.');
      setSubmitting(false);
      return;
    }
    try {
      const res = await acceptInvitation(extracted);
      setToken(res.accessToken);
      window.location.assign('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Token không hợp lệ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-bold text-white">
            C
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {t('setup_title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('setup_subtitle')}
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="block w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-emerald-300 hover:shadow-md"
            >
              <div className="text-base font-semibold text-foreground">
                🏠 Tạo gia đình mới
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Mời vợ/chồng vào sau bằng email link.
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="block w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-emerald-300 hover:shadow-md"
            >
              <div className="text-base font-semibold text-foreground">
                ✉️ Tham gia bằng link mời
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Nếu vợ/chồng đã gửi link cho bạn.
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form
            onSubmit={onCreate}
            className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Tên gia đình
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Ngày cưới (tuỳ chọn)
              </label>
              <input
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className={inputClass}
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                ← {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-muted"
              >
                {submitting ? tCommon('saving') : tCommon('save')}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form
            onSubmit={onJoin}
            className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">
              Dán link mời (vd <code>http://localhost:3000/invite/...</code>)
              hoặc chỉ riêng token:
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Link / Token mời
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setTokenInput(e.target.value)}
                required
                placeholder="UUID token từ link mời"
                className={`${inputClass} font-mono text-xs`}
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                ← {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-muted"
              >
                {submitting ? tCommon('loading') : tCommon('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(UUID_RE);
  return match ? match[0] : null;
}
