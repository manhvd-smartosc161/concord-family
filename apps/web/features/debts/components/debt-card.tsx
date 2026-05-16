'use client';

import { useTranslations } from 'next-intl';
import { formatVND } from '@/lib/format';
import { ProgressBar, Badge } from '@/components/ui';
import type { DebtView } from '../types';

interface Props {
  debt: DebtView;
  onClick: () => void;
  onRecordPayment: () => void;
}

export function DebtCard({ debt, onClick, onRecordPayment }: Props) {
  const t = useTranslations('debts');
  const pct = debt.principal > 0 ? Math.min(100, (debt.paidAmount / debt.principal) * 100) : 0;
  const isLent = debt.direction === 'lent';

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md ${
        isLent
          ? 'border-emerald-200 dark:border-emerald-900'
          : 'border-amber-200 dark:border-amber-900'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full p-3 text-left sm:p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {debt.counterpartyName}
              </span>
              <Badge tone={isLent ? 'emerald' : 'amber'}>
                {isLent ? t('direction_lent') : t('direction_borrowed')}
              </Badge>
              {debt.status === 'settled' && (
                <Badge tone="neutral">{t('status_settled')}</Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {debt.fundName} · {new Date(debt.openedAt).toLocaleDateString('vi-VN')}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatVND(debt.remainingAmount)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              / {formatVND(debt.principal)}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar
            value={debt.paidAmount}
            max={debt.principal}
            tone={isLent ? 'emerald' : 'amber'}
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            {t('paid_pct', { pct: pct.toFixed(0) })}
          </div>
        </div>
      </button>

      {debt.status === 'open' && (
        <div className="border-t border-border px-3 pb-3 pt-2 sm:px-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRecordPayment();
            }}
            className="w-full rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-800"
          >
            {t('action_record_payment')}
          </button>
        </div>
      )}
    </div>
  );
}
