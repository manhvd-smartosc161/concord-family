'use client';

import { useTranslations } from 'next-intl';
import type { FundView } from '../types';

export function FundFilterTabs({
  funds,
  value,
  onChange,
}: {
  funds: FundView[];
  value: string | 'all';
  onChange: (v: string | 'all') => void;
}) {
  const t = useTranslations('transactions');
  const tabs: Array<
    { id: 'all' | string; label: string; icon: string; disabled?: boolean }
  > = [
    { id: 'all', label: t('all_funds_filter'), icon: '📋' },
    ...funds.map((f) => ({
      id: f.id,
      label: f.name.replace('Quỹ ', ''),
      icon:
        f.accessLevel === 'private'
          ? '🔒'
          : f.type === 'joint'
            ? '🤝'
            : '💰',
      disabled: f.accessLevel === 'private',
    })),
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : t.disabled
                  ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-300'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        );
      })}
    </div>
  );
}
