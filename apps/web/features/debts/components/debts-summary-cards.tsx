'use client';

import { formatVND } from '@/lib/format';
import { Card } from '@/components/ui';
import type { DebtSummary } from '../types';

export function DebtsSummaryCards({ summary }: { summary: DebtSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Đã cho vay
        </div>
        <div className="mt-1 break-words font-mono text-lg font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-xl">
          {formatVND(summary.totalLent)}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {summary.openLentCount} khoản đang mở
        </div>
      </Card>
      <Card>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Đang nợ
        </div>
        <div className="mt-1 break-words font-mono text-lg font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-400 sm:text-xl">
          {formatVND(summary.totalBorrowed)}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {summary.openBorrowedCount} khoản đang mở
        </div>
      </Card>
    </div>
  );
}
