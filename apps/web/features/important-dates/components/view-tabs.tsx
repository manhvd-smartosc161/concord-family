'use client';

import Link from 'next/link';

type ViewKey = 'upcoming' | 'year' | 'calendar';

const TABS: { key: ViewKey; label: string; href: string }[] = [
  { key: 'upcoming', label: 'Sắp tới', href: '/important-dates' },
  { key: 'year', label: 'Theo năm', href: '/important-dates/year' },
  { key: 'calendar', label: 'Calendar', href: '/important-dates/calendar' },
];

export function ViewTabs({ current }: { current: ViewKey }) {
  return (
    <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <div className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-stone-200">
        {TABS.map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
