'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  formatVND,
  listCategories,
  updateTransaction,
  type CategoryView,
  type FundView,
  type TransactionView,
} from '../../../lib/api';

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
      setError('Số tiền phải là số dương');
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
            : 'Lỗi không xác định';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-base font-semibold text-stone-900">
            Sửa giao dịch
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
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
        <p className="mb-5 text-xs text-stone-500">
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
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              − Chi
            </button>
            <button
              type="button"
              onClick={() => setIsExpense(false)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                !isExpense
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              + Thu
            </button>
          </div>

          {/* Fund + Amount */}
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field label="Quỹ">
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={submitting}
              >
                {writableFunds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền (VND)">
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) =>
                  setAmountStr(e.target.value.replace(/[^\d]/g, ''))
                }
                placeholder="200000"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-mono tabular-nums focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={submitting}
              />
              {amountStr && (
                <p className="mt-1 text-[11px] text-stone-400">
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
          <Field label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              disabled={submitting}
            >
              <option value="">— không phân loại —</option>
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
          <Field label="Ghi chú">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="vd: ăn Haidilao chung với cả nhà"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              disabled={submitting}
              maxLength={200}
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={submitting || !fundId || !amountStr}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
            >
              {submitting ? 'Đang lưu…' : 'Lưu'}
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
      <label className="mb-1.5 block text-xs font-medium text-stone-700">
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
