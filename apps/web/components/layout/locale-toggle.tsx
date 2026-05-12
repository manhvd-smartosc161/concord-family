'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();

  function switchLocale(next: 'vi' | 'en') {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};max-age=31536000;path=/`;
    router.refresh();
  }

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-stone-200 text-xs font-medium">
      <button
        type="button"
        onClick={() => switchLocale('vi')}
        className={`px-2 py-1 transition-colors ${
          locale === 'vi'
            ? 'bg-emerald-50 text-emerald-700'
            : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        VI
      </button>
      <span className="text-stone-200">|</span>
      <button
        type="button"
        onClick={() => switchLocale('en')}
        className={`px-2 py-1 transition-colors ${
          locale === 'en'
            ? 'bg-emerald-50 text-emerald-700'
            : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        EN
      </button>
    </div>
  );
}
