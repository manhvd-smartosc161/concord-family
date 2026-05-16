'use client';

import { formatVND } from '@/lib/format';
import type { DebtView } from '../types';

export function DebtCard({
  debt,
  onClick,
}: {
  debt: DebtView;
  onClick: () => void;
}) {
  const isOwe = debt.direction === 'i_owe';
  const accentBg = isOwe
    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900';
  const accentText = isOwe ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300';

  let dueLabel: string | null = null;
  if (debt.dueDate) {
    const due = new Date(debt.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) dueLabel = `Quá hạn ${-diffDays} ngày`;
    else if (diffDays === 0) dueLabel = 'Đến hạn hôm nay';
    else dueLabel = `Còn ${diffDays} ngày`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:brightness-95 ${accentBg}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {debt.counterparty}
          </span>
          {debt.visibility === 'private' && <span title="Riêng tư">🔒</span>}
          {debt.visibility === 'shared' && <span title="Cả nhà thấy">👥</span>}
          {debt.status === 'closed' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Đã đóng
            </span>
          )}
        </div>
        {(dueLabel || debt.note) && (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {dueLabel}
            {dueLabel && debt.note && ' · '}
            {debt.note}
          </div>
        )}
      </div>
      <div className={`ml-3 shrink-0 text-right font-mono text-base font-semibold tabular-nums ${accentText}`}>
        {formatVND(debt.outstanding)}
      </div>
    </button>
  );
}
