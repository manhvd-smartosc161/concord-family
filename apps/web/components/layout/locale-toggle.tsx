'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const LOCALES = [
  { key: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { key: 'en', flag: '🇬🇧', label: 'English' },
] as const;

export function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function switchLocale(next: 'vi' | 'en') {
    setOpen(false);
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};max-age=31536000;path=/`;
    router.refresh();
  }

  const current = LOCALES.find((l) => l.key === locale) ?? LOCALES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors hover:border-stone-200 hover:bg-stone-50"
      >
        <span className="text-xl leading-none">{current.flag}</span>
        <svg
          className={`h-3 w-3 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
            {LOCALES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => switchLocale(l.key)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 ${
                  locale === l.key ? 'font-medium text-emerald-700' : 'text-stone-700'
                }`}
              >
                <span className="text-base leading-none">{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
