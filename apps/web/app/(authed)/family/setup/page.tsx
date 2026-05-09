'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
    <main className="flex min-h-full items-center justify-center bg-stone-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-bold text-white">
            C
          </div>
          <h1 className="text-xl font-semibold text-stone-900">
            Chào {user.name}!
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Để bắt đầu, hãy tạo hoặc tham gia một gia đình.
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="block w-full rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm hover:border-emerald-300 hover:shadow-md"
            >
              <div className="text-base font-semibold text-stone-900">
                🏠 Tạo gia đình mới
              </div>
              <div className="mt-1 text-xs text-stone-500">
                Mời vợ/chồng vào sau bằng email link.
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="block w-full rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm hover:border-emerald-300 hover:shadow-md"
            >
              <div className="text-base font-semibold text-stone-900">
                ✉️ Tham gia bằng link mời
              </div>
              <div className="mt-1 text-xs text-stone-500">
                Nếu vợ/chồng đã gửi link cho bạn.
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form
            onSubmit={onCreate}
            className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
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
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
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
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                ← Quay lại
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300"
              >
                {submitting ? 'Đang tạo…' : 'Tạo gia đình'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form
            onSubmit={onJoin}
            className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs text-stone-500">
              Dán link mời (vd <code>http://localhost:3000/invite/...</code>)
              hoặc chỉ riêng token:
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
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
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                ← Quay lại
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300"
              >
                {submitting ? 'Đang join…' : 'Tham gia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(UUID_RE);
  return match ? match[0] : null;
}
