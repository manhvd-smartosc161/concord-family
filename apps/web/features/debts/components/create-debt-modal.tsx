'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import type { FundView } from '@/features/funds/types';
import { createDebt } from '../api';
import type { DebtDirection } from '../types';

interface Props {
  open: boolean;
  funds: FundView[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateDebtModal({ open, funds, onClose, onSuccess }: Props) {
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [principalStr, setPrincipalStr] = useState('');
  const [fundId, setFundId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const spendingFunds = useMemo(
    () => funds.filter((f) => f.purpose === 'spending' && f.accessLevel !== 'private'),
    [funds],
  );

  useEffect(() => {
    if (!open) return;
    setDirection('lent');
    setCounterpartyName('');
    setPrincipalStr('');
    setNote('');
    setError(null);
    setSubmitting(false);
    if (spendingFunds.length > 0) setFundId(spendingFunds[0].id);
  }, [open, spendingFunds]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const principal = parseInt(principalStr.replace(/[^\d]/g, ''), 10) || 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!counterpartyName.trim()) {
      setError('Tên đối tác không được rỗng');
      return;
    }
    if (!principal || principal <= 0) {
      setError('Số tiền phải lớn hơn 0');
      return;
    }
    if (!fundId) {
      setError('Chọn quỹ');
      return;
    }

    setSubmitting(true);
    try {
      await createDebt({
        direction,
        counterpartyName: counterpartyName.trim(),
        principal,
        fundId,
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
          <h3 className="text-base font-semibold text-foreground">
            Thêm khoản nợ / cho vay
          </h3>
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('lent')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                direction === 'lent'
                  ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              🤝 Cho vay
            </button>
            <button
              type="button"
              onClick={() => setDirection('borrowed')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                direction === 'borrowed'
                  ? 'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              💸 Đi vay
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              {direction === 'lent' ? 'Người được vay' : 'Người cho vay'}
            </label>
            <input
              type="text"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder="vd: Anh Nam"
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
              disabled={submitting}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Số tiền (VND)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={principalStr}
                onChange={(e) => setPrincipalStr(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm font-mono tabular-nums focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={submitting}
              />
              {principal > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">= {formatVND(principal)}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Quỹ
              </label>
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={submitting}
              >
                {spendingFunds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Ghi chú (tuỳ chọn)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="vd: vay mua xe, trả sau Tết"
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
              disabled={submitting || !counterpartyName.trim() || !principal}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-muted disabled:text-muted-foreground sm:w-auto"
            >
              {submitting ? 'Đang lưu…' : 'Tạo khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
