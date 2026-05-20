'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { getFinancialMonthRange } from '@/lib/financial-month';
import type { FundView } from '@/features/funds/types';
import { deleteTransaction, listTransactions } from '../api';
import type { TransactionView } from '../types';
import { groupByDay } from '../lib/group-by-day';
import { DayGroup } from './day-group';
import { EditTransactionModal } from './edit-transaction-modal';

interface Props {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  year: number;
  month: number;
  cutoffDay: number;
  fundId: string | undefined;
  funds: FundView[];
  onClose: () => void;
  onMutated: () => void;
}

export function CategoryTransactionsModal({
  open,
  categoryId,
  categoryName,
  categoryIcon,
  year,
  month,
  cutoffDay,
  fundId,
  funds,
  onClose,
  onMutated,
}: Props) {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const [items, setItems] = useState<TransactionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTxn, setEditTxn] = useState<TransactionView | null>(null);

  const fetchData = useCallback(async () => {
    if (!open || !categoryId) return;
    setLoading(true);
    const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
    const apiEnd = new Date(end.getTime() - 1);
    try {
      const res = await listTransactions({
        fundId: fundId || undefined,
        categoryId,
        from: start.toISOString(),
        to: apiEnd.toISOString(),
        limit: 200,
      });
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [open, categoryId, year, month, cutoffDay, fundId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const grouped = useMemo(() => groupByDay(items), [items]);
  const total = useMemo(
    () => items.reduce((acc, x) => acc + (x.amount < 0 ? -x.amount : 0), 0),
    [items],
  );

  async function handleDelete(id: string) {
    if (!confirm(t('delete_confirm'))) return;
    try {
      await deleteTransaction(id);
      await fetchData();
      onMutated();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : tCommon('error');
      alert(tCommon('cannot_delete', { msg }));
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label={tCommon('close')}
          onClick={onClose}
          className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        />
        <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-card p-4 shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span>{categoryIcon ?? '·'}</span>
                <span className="truncate">{categoryName}</span>
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {items.length} {t('title').toLowerCase()} ·{' '}
                <span className="font-mono tabular-nums">
                  −{formatVND(total)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-full animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('no_transactions')}
              </div>
            )}
            {!loading && items.length > 0 && (
              <div>
                {grouped.map((g) => (
                  <DayGroup
                    key={g.day}
                    day={g.day}
                    items={g.items}
                    onEdit={setEditTxn}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <EditTransactionModal
        open={editTxn !== null}
        txn={editTxn}
        funds={funds}
        onClose={() => setEditTxn(null)}
        onSaved={() => {
          void fetchData();
          onMutated();
        }}
      />
    </>
  );
}
