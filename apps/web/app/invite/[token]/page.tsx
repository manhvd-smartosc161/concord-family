'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { setToken } from '@/lib/api-client';
import { acceptInvitation, getInvitation } from '@/features/families/api';
import { useAuth } from '@/features/auth/hooks';
import type { InvitationPreview } from '@/features/families/types';

export default function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const auth = useAuth(false);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    void getInvitation(token)
      .then(setPreview)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Link không hợp lệ'),
      );
  }, [token]);

  useEffect(() => {
    if (auth.status !== 'authed' || !preview || accepting) return;
    if (auth.user.familyId) {
      setError('Bạn đã ở trong một gia đình rồi. Hãy thoát trước nếu muốn join family khác.');
      return;
    }
    setAccepting(true);
    void acceptInvitation(token)
      .then((r) => {
        setToken(r.accessToken);
        window.location.assign('/dashboard');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Accept thất bại');
        setAccepting(false);
      });
  }, [auth, preview, token, accepting, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <div className="text-base font-semibold text-rose-900">
            ⚠️ {error}
          </div>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            ← Về trang đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-400">
        Đang tải…
      </main>
    );
  }

  if (auth.status === 'unauthed') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">
            ✉️ Lời mời tham gia
          </h1>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <strong>{preview.inviter.name}</strong> mời bạn tham gia gia đình{' '}
            <strong>{preview.family.name}</strong>.
          </div>
          <p className="text-xs text-stone-500">
            Đăng nhập hoặc đăng ký để tiếp tục.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-center text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Đăng nhập
            </Link>
            <Link
              href={`/register?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-800"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-400">
      Đang xử lý…
    </main>
  );
}
