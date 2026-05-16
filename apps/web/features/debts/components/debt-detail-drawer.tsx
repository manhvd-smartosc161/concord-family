'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { Badge, ProgressBar } from '@/components/ui';
import { getDebt, deletePayment, deleteDebt } from '../api';
import type { DebtDetail, DebtView } from '../types';

interface Props {
  open: boolean;
  debtId: string | null;
  onClose: () => void;
  onMutated: () => void;
}

export function DebtDetailDrawer({ open, debtId, onClose, onMutated }: Props) {
  const t = useTranslations('debts');
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!debtId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getDebt(debtId);
      setDetail(d);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [debtId]);

  useEffect(() => {
    if (open && debtId) void load();
    if (!open) setDetail(null);
  }, [open, debtId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const debt = detail?.debt;
  const payments = detail?.payments ?? [];
  const repayments = payments.filter((p) => p.kind === 'repayment');

  async function handleDeletePayment(paymentId: string) {
    if (!debt) return;
    if (!confirm(t('btn_delete_payment_confirm'))) return;
    try {
      await deletePayment(debt.id, paymentId);
      await load();
      onMutated();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      alert(msg);
    }
  }

  async function handleDeleteDebt() {
    if (!debt) return;
    if (!confirm(t('btn_delete_debt_confirm'))) return;
    setDeleting(true);
    try {
      await deleteDebt(debt.id);
      onMutated();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold text-foreground">{t('drawer_title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-300">
              {error}
            </div>
          )}

          {debt && !loading && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{debt.counterpartyName}</span>
                  <Badge tone={debt.direction === 'lent' ? 'emerald' : 'amber'}>
                    {debt.direction === 'lent' ? t('direction_lent') : t('direction_borrowed')}
                  </Badge>
                  {debt.status === 'settled' && <Badge tone="neutral">{t('status_settled')}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {debt.fundName} · Từ {new Date(debt.openedAt).toLocaleDateString('vi-VN')}
                  {debt.closedAt && ` · Đóng ${new Date(debt.closedAt).toLocaleDateString('vi-VN')}`}
                </p>
                {debt.note && (
                  <p className="mt-1 text-xs text-muted-foreground italic">{debt.note}</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('paid')}</span>
                  <span>{t('remaining')}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatVND(debt.paidAmount)}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatVND(debt.remainingAmount)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={debt.paidAmount}
                    max={debt.principal}
                    tone={debt.direction === 'lent' ? 'emerald' : 'amber'}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('principal')}: {formatVND(debt.principal)}
                </p>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('history')}
                </h4>
                {repayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('no_payments')}</p>
                ) : (
                  <div className="space-y-2">
                    {repayments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div>
                          <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatVND(p.amount)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(p.paidAt).toLocaleDateString('vi-VN')}
                            {p.note && ` · ${p.note}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id)}
                          className="rounded-md px-2 py-1 text-xs text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          {t('btn_delete_payment')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  onClick={handleDeleteDebt}
                  disabled={deleting}
                  className="w-full rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-2 text-sm font-medium text-rose-800 dark:text-rose-300 transition-colors hover:bg-rose-100 dark:hover:bg-rose-950/60 disabled:opacity-50"
                >
                  {deleting ? t('btn_deleting') : t('btn_delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
