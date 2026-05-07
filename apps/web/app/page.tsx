'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks';

export default function Home() {
  const router = useRouter();
  const auth = useAuth(false);

  useEffect(() => {
    if (auth.status === 'loading') return;
    router.replace(auth.status === 'authed' ? '/dashboard' : '/login');
  }, [auth.status, router]);

  return (
    <div className="flex h-screen items-center justify-center text-stone-400">
      <div className="text-sm">Đang mở Concord…</div>
    </div>
  );
}
