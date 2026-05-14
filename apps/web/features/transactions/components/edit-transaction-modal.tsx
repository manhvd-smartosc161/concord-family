'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { listCategories } from '@/features/categories/api';
import type { CategoryView } from '@/features/categories/types';
import type { FundView } from '@/features/funds/types';
import { updateTransaction } from '@/features/transactions/api';
import type { TransactionView } from '@/features/transactions/types';

interface Props {
  open: boolean;
  txn: TransactionView | null;
  funds: FundView[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransactionModal({
  open,
  txn,
  funds,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [fundId, setFundId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Hydrate form from txn each time modal opens
  useEffect(() => {
    if (!open || !txn) return;
    setFundId(txn.fund.id);
    setAmountStr(Math.abs(txn.amount).toString());
    setIsExpense(txn.amount < 0);
    setCategoryId(txn.category?.id ?? '');
    setNote(txn.note ?? '');
    setError(null);
    setSubmitting(false);
  }, [open, txn]);

  // Load categories once
  useEffect(() => {
    if (categories.length > 0) return;
    listCategories()
      .then(setCategories)
      .catch(() => {});
  }, [categories.length]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const writableFunds = useMemo(
    () => funds.filter((f) => f.accessLevel !== 'private'),
    [funds],
  );

  const groupedCats = useMemo(() => groupCategories(categories), [categories]);

  if (!open || !txn) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!txn) return;

    const absAmount = parseInt(amountStr.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(absAmount) || absAmount === 0) {
      setError(t('amount_required'));
      return;
    }
    const signedAmount = isExpense ? -absAmount : absAmount;

    setSubmitting(true);
    try {
      await updateTransaction(txn.id, {
        fundId,
        amount: signedAmount,
        categoryId: categoryId || null,
        note: note.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : tCommon('error');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={tCommon('close')}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-card p-4 shadow-2xl sm:p-6">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-base font-semibold text-foreground">
            {t('edit_title')}
          </h3>
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
        <p className="mb-5 text-xs text-muted-foreground">
          Đổi quỹ / số tiền / category — số dư cả 2 quỹ sẽ được tính lại tự động.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsExpense(true)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                isExpense
                  ? 'border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              − {t('expense')}
            </button>
            <button
              type="button"
              onClick={() => setIsExpense(false)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                !isExpense
                  ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              + {t('income')}
            </button>
          </div>

          {/* Fund + Amount */}
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field label={t('fund')}>
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={submitting}
              >
                {writableFunds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('amount')}>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) =>
                  setAmountStr(e.target.value.replace(/[^\d]/g, ''))
                }
                placeholder="200000"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm font-mono tabular-nums focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={submitting}
              />
              {amountStr && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  ={' '}
                  {formatVND(
                    (isExpense ? -1 : 1) * parseInt(amountStr || '0', 10),
                    true,
                  )}
                </p>
              )}
            </Field>
          </div>

          {/* Category */}
          <Field label={t('category')}>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
              disabled={submitting}
            >
              <option value="">— {t('no_category')} —</option>
              {groupedCats.map((g) => (
                <optgroup key={g.parentId ?? 'top'} label={g.parentLabel}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          {/* Note */}
          <Field label={t('note')}>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="vd: ăn Haidilao chung với cả nhà"
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
              disabled={submitting}
              maxLength={200}
            />
          </Field>

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
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !fundId || !amountStr}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-muted disabled:text-muted-foreground sm:w-auto"
            >
              {submitting ? tCommon('saving') : tCommon('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

interface CategoryGroup {
  parentId: string | null;
  parentLabel: string;
  items: CategoryView[];
}

function groupCategories(cats: CategoryView[]): CategoryGroup[] {
  // Top-level categories (parent = null) become group headers; their children
  // are listed underneath.
  const tops = cats.filter((c) => c.parentId === null);
  const out: CategoryGroup[] = [];
  for (const top of tops) {
    const items = cats.filter((c) => c.parentId === top.id);
    if (items.length === 0) {
      // No children — list the top-level itself as its own item (eg "Chuyển nội bộ")
      out.push({
        parentId: top.id,
        parentLabel: `${top.icon ?? ''} ${top.name}`.trim(),
        items: [top],
      });
    } else {
      out.push({
        parentId: top.id,
        parentLabel: `${top.icon ?? ''} ${top.name}`.trim(),
        items: [top, ...items],
      });
    }
  }
  return out;
}
