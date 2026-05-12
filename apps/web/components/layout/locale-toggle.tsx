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
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => switchLocale('vi')}
        title="Tiếng Việt"
        className={`text-lg leading-none transition-opacity ${
          locale === 'vi' ? 'opacity-100' : 'opacity-35 hover:opacity-60'
        }`}
      >
        🇻🇳
      </button>
      <button
        type="button"
        onClick={() => switchLocale('en')}
        title="English"
        className={`text-lg leading-none transition-opacity ${
          locale === 'en' ? 'opacity-100' : 'opacity-35 hover:opacity-60'
        }`}
      >
        🇬🇧
      </button>
    </div>
  );
}
