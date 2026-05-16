'use client';

import { useEffect, useState } from 'react';
import { createPayment } from '../api';
import type { DebtPaymentView } from '../types';

export function PaymentFormModal({
  open,
  debtId,
  remaining,
  onClose,
  onSaved,
}: {
  open: boolean;
  debtId: string;
  remaining: number;
  onClose: () => void;
  onSaved: (payment: DebtPaymentView) => void;
}) {
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount('');
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNote('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const amt = parseInt(amount.replace(/\D/g, ''), 10);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Số tiền không hợp lệ');
      const saved = await createPayment(debtId, {
        amount: amt,
        paidAt: new Date(paidAt).toISOString(),
        note: note.trim() || undefined,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-foreground">Thêm khoản thanh toán</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Số tiền (VND) · Còn lại {remaining.toLocaleString('vi-VN')}đ
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setAmount(digits ? parseInt(digits, 10).toLocaleString('vi-VN') : '');
              }}
              placeholder="0"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ngày trả</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-muted disabled:text-muted-foreground"
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
