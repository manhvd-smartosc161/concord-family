'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { recordPayment } from '../api';
import type { DebtView } from '../types';

interface Props {
  open: boolean;
  debt: DebtView | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({ open, debt, onClose, onSuccess }: Props) {
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmountStr('');
    setNote('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !debt) return null;

  const amount = parseInt(amountStr.replace(/[^\d]/g, ''), 10) || 0;
  const remaining = debt.remainingAmount;
  const afterPayment = remaining - amount;
  const willSettle = amount >= remaining;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt) return;
    setError(null);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Số tiền phải lớn hơn 0');
      return;
    }
    if (amount > remaining) {
      setError(`Số tiền vượt quá số dư còn lại (${formatVND(remaining)})`);
      return;
    }

    setSubmitting(true);
    try {
      await recordPayment(debt.id, {
        amount,
        note: note.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-card p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Ghi trả — {debt.counterpartyName}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Còn lại: {formatVND(remaining)}
            </p>
          </div>
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Số tiền (VND)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max={remaining}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm font-mono tabular-nums focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
              disabled={submitting}
            />
            {amount > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sau khi trả: còn{' '}
                <span className={willSettle ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''}>
                  {formatVND(Math.max(0, afterPayment))}
                </span>
                {willSettle && ' · Khoản nợ sẽ được đóng ✓'}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Ghi chú (tuỳ chọn)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="vd: trả qua chuyển khoản"
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
              disabled={submitting}
              maxLength={200}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={submitting || amount <= 0}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-muted disabled:text-muted-foreground sm:w-auto"
            >
              {submitting ? 'Đang lưu…' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
