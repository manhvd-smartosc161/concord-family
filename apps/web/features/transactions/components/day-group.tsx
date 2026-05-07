'use client';

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
  const dayLabel = formatDayLabel(day);
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between border-b border-stone-100 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {dayLabel}
        </span>
        <span className="text-[11px] text-stone-400">
          {items.length} giao dịch
        </span>
      </div>
      {items.map((t) => (
        <TxnRow
          key={t.id}
          t={t}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t.id)}
        />
      ))}
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
  const isExpense = t.amount < 0;
  const isInternal = t.category?.name === 'Chuyển nội bộ';
  return (
    <div className="group flex items-center justify-between border-b border-stone-50 py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-base">
          {t.category?.icon ?? (isExpense ? '💸' : '💰')}
        </span>
        <div className="leading-tight">
          <div className="text-sm text-stone-800">
            {t.note ?? t.category?.name ?? '(không ghi chú)'}
          </div>
          <div className="text-[11px] text-stone-500">
            <span className="font-medium">{t.fund.name}</span>
            {t.category && ` · ${t.category.name}`}
            {' · '}
            {new Date(t.date).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' · '}
            <span className="text-stone-400">{t.loggedBy.name}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${
            isInternal
              ? 'text-stone-500'
              : isExpense
                ? 'text-rose-700'
                : 'text-emerald-700'
          }`}
        >
          {formatVND(t.amount, true)}
        </span>
        <div className="invisible flex items-center gap-1 group-hover:visible">
          <button
            onClick={onEdit}
            aria-label="Sửa"
            title="Sửa quỹ / số tiền / category"
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            aria-label="Xoá"
            title="Xoá + hoàn lại số dư"
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
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
