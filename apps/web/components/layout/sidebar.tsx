'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FundCard } from '@/features/funds/components/fund-card';
import type { FundView } from '@/features/funds/types';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/transactions', label: 'Giao dịch', icon: '📒' },
  { href: '/reports', label: 'Báo cáo', icon: '📈' },
  { href: '/goals', label: 'Mục tiêu', icon: '🎯' },
  { href: '/important-dates', label: 'Ngày quan trọng', icon: '📅' },
  { href: '/settings', label: 'Cài đặt', icon: '⚙️' },
];

export function Sidebar({ funds }: { funds: FundView[] }) {
  const pathname = usePathname();
  return (
    <aside className="flex flex-col overflow-y-auto border-r border-stone-200 bg-white">
      <nav className="space-y-0.5 p-3">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-emerald-50 font-medium text-emerald-900'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 my-2 border-t border-stone-100" />

      <div className="space-y-2 px-3">
        <h3 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Quỹ của bạn
        </h3>
        {funds.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-lg bg-stone-100"
              />
            ))}
          </div>
        )}
        {funds.map((f) => (
          <FundCard key={f.id} fund={f} />
        ))}
      </div>

      <div className="mt-auto p-3 text-[10px] leading-relaxed text-stone-400">
        MVP Tuần 1 · Parser subagent (Haiku 4.5) · Auth JWT
      </div>
    </aside>
  );
}
