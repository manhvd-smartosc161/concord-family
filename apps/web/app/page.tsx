'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks';

export default function Home() {
  const router = useRouter();
  const { state: auth } = useAuth(false);

  useEffect(() => {
    if (auth.status === 'loading') return;
    router.replace(auth.status === 'authed' ? '/chat' : '/login');
  }, [auth.status, router]);

  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <div className="text-sm">Đang mở Concord…</div>
    </div>
  );
}
