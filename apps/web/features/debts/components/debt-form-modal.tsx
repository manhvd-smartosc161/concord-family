'use client';

import { useEffect, useState } from 'react';
import { createDebt, updateDebt } from '../api';
import type { DebtDirection, DebtView, DebtVisibility } from '../types';

export function DebtFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (debt: DebtView) => void;
  initial?: DebtView | null;
}) {
  const [direction, setDirection] = useState<DebtDirection>('i_owe');
  const [counterparty, setCounterparty] = useState('');
  const [principal, setPrincipal] = useState('');
  const [visibility, setVisibility] = useState<DebtVisibility>('private');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initial) {
        setDirection(initial.direction);
        setCounterparty(initial.counterparty);
        setPrincipal(initial.principal.toLocaleString('vi-VN'));
        setVisibility(initial.visibility);
        setDueDate(initial.dueDate ?? '');
        setNote(initial.note ?? '');
      } else {
        setDirection('i_owe');
        setCounterparty('');
        setPrincipal('');
        setVisibility('private');
        setDueDate('');
        setNote('');
      }
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const amount = parseInt(principal.replace(/\D/g, ''), 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Số tiền không hợp lệ');
      }
      const basePayload = {
        counterparty: counterparty.trim(),
        principal: amount,
        visibility,
        dueDate: dueDate || null,
        note: note.trim() || null,
      };
      const saved = initial
        ? await updateDebt(initial.id, basePayload)
        : await createDebt({ ...basePayload, direction });
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
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {initial ? 'Chỉnh sửa khoản' : 'Thêm khoản nợ / cho vay'}
        </h2>
        <form onSubmit={onSubmit} className="space-y-3">
          {!initial && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('i_owe')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${direction === 'i_owe' ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300' : 'border-border bg-background text-muted-foreground'}`}
              >
                💳 Tôi đang nợ
              </button>
              <button
                type="button"
                onClick={() => setDirection('they_owe_me')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${direction === 'they_owe_me' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground'}`}
              >
                🤝 Đang cho vay
              </button>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {direction === 'i_owe' ? 'Chủ nợ' : 'Người vay'}
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="VD: Thẻ Sacombank, Anh Tuấn…"
              required
              maxLength={200}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Số tiền (VND)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={principal}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setPrincipal(digits ? parseInt(digits, 10).toLocaleString('vi-VN') : '');
              }}
              placeholder="0"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Hiển thị với
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs ${visibility === 'private' ? 'border-foreground bg-muted text-foreground' : 'border-border bg-background text-muted-foreground'}`}
              >
                🔒 Riêng tư
              </button>
              <button
                type="button"
                onClick={() => setVisibility('shared')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs ${visibility === 'shared' ? 'border-foreground bg-muted text-foreground' : 'border-border bg-background text-muted-foreground'}`}
              >
                👥 Cả nhà thấy
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Ngày hạn (tuỳ chọn)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Ghi chú
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
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
              {saving ? 'Đang lưu…' : initial ? 'Cập nhật' : 'Tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
