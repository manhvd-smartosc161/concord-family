'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatVND } from '@/lib/format';
import type { TransactionView } from '../types';
import { formatDayLabel } from '../lib/group-by-day';

export function DayGroup({
  day,
  items,
  onEdit,
  onDelete,
}: {
  day: string;
  items: TransactionView[];
  onEdit: (t: TransactionView) => void;
  onDelete: (id: string) => void;
}) {
  const tDayGroup = useTranslations('transactions');
  const locale = useLocale();
  const dayLabel = formatDayLabel(day, { today: tDayGroup('day_today'), yesterday: tDayGroup('day_yesterday') }, locale);
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between border-b border-border pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dayLabel}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {items.length} {tDayGroup('title').toLowerCase()}
        </span>
      </div>
      <div>
        {items.map((t) => (
          <TxnRow
            key={t.id}
            t={t}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TxnRow({
  t,
  onEdit,
  onDelete,
}: {
  t: TransactionView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tTxn = useTranslations('transactions');
  const isExpense = t.amount < 0;
  const isInternal = t.category?.name === 'Chuyển nội bộ';
  return (
    <div className="group flex items-center gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-base flex-shrink-0">
        {t.category?.icon ?? (isExpense ? '💸' : '💰')}
      </span>
      <div className="leading-tight min-w-0 flex-1 truncate">
        <div className="text-sm text-foreground truncate">
          {t.note ?? t.category?.name ?? tTxn('no_category')}
        </div>
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium">{t.fund.name}</span>
          {t.category && ` · ${t.category.name}`}
          {' · '}
          {new Date(t.date).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          <span className="text-muted-foreground/70">{t.loggedBy.name}</span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <span
          className={`text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
            isInternal
              ? 'text-muted-foreground'
              : isExpense
                ? 'text-rose-700'
                : 'text-emerald-700'
          }`}
        >
          {formatVND(t.amount, true)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            aria-label="Edit"
            title="Edit fund / amount / category"
            className="rounded-md p-1 text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete"
            title="Delete and restore balance"
            className="rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
