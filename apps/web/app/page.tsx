'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getToken } from '../lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-stone-400">
      <div className="text-sm">Đang mở Concord…</div>
    </div>
  );
}
