'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  formatFinancialMonthRange,
  getFinancialMonthRange,
} from '@/lib/financial-month';

export function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
  cutoffDay = 1,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
  cutoffDay?: number;
}) {
  const t = useTranslations('transactions');
  const locale = useLocale();
  const label = new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'vi-VN',
    { month: 'long', year: 'numeric' },
  );

  let subtitle: string | null = null;
  if (cutoffDay > 1) {
    const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
    subtitle = formatFinancialMonthRange(start, end, locale === 'en' ? 'en' : 'vi');
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 sm:p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        aria-label={t('prev_month')}
      >
        <Chevron dir="left" />
      </button>
      <div className="min-w-[100px] px-2 py-1 text-center text-xs font-medium text-foreground sm:min-w-[120px] sm:px-3 sm:py-1 sm:text-sm">
        <div>{label}</div>
        {subtitle && (
          <div
            className="text-[10px] font-normal text-muted-foreground"
            aria-label={t('fiscal_range_aria')}
          >
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={t('next_month')}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}
