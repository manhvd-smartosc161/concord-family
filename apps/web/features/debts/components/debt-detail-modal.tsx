'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatVND } from '@/lib/format';
import { closeDebt, deleteDebt, deletePayment, getDebt, reopenDebt } from '../api';
import type { DebtDetail, DebtPaymentView } from '../types';
import { PaymentFormModal } from './payment-form-modal';

export function DebtDetailModal({
  open,
  debtId,
  onClose,
  onEdit,
  onChanged,
}: {
  open: boolean;
  debtId: string | null;
  onClose: () => void;
  onEdit: (detail: DebtDetail) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!debtId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getDebt(debtId);
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [debtId]);

  useEffect(() => {
    if (open && debtId) void reload();
    else if (!open) setDetail(null);
  }, [open, debtId, reload]);

  if (!open) return null;

  async function handleDelete() {
    if (!detail) return;
    if (!confirm(`Xóa khoản "${detail.counterparty}"?`)) return;
    try {
      await deleteDebt(detail.id);
      onChanged();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi xóa');
    }
  }

  async function handleClose() {
    if (!detail) return;
    try {
      await closeDebt(detail.id);
      await reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi');
    }
  }

  async function handleReopen() {
    if (!detail) return;
    try {
      await reopenDebt(detail.id);
      await reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi');
    }
  }

  async function handleDeletePayment(p: DebtPaymentView) {
    if (!detail) return;
    if (!confirm(`Xóa khoản thanh toán ${formatVND(p.amount)}?`)) return;
    try {
      await deletePayment(detail.id, p.id);
      await reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi xóa');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-lg">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Đang tải…</div>}
        {error && <div className="m-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
        {detail && (
          <>
            <div className="border-b border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">{detail.counterparty}</h2>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{detail.direction === 'i_owe' ? '💳 Tôi đang nợ' : '🤝 Đang cho vay'}</span>
                    {detail.visibility === 'private' && <span>· 🔒 Riêng tư</span>}
                    {detail.visibility === 'shared' && <span>· 👥 Cả nhà thấy</span>}
                    {detail.status === 'closed' && <span>· Đã đóng</span>}
                  </div>
                </div>
                {detail.isMine && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => onEdit(detail)}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                    >
                      ✏️ Sửa
                    </button>
                    {detail.status === 'open' ? (
                      <button
                        onClick={handleClose}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        🔒 Đóng
                      </button>
                    ) : (
                      <button
                        onClick={handleReopen}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        ↺ Mở lại
                      </button>
                    )}
                    <button
                      onClick={handleDelete}
                      className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Còn lại</div>
                  <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {formatVND(detail.outstanding)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Gốc</div>
                  <div className="mt-0.5 font-mono text-lg tabular-nums text-muted-foreground">
                    {formatVND(detail.principal)}
                  </div>
                </div>
              </div>
              {detail.note && (
                <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {detail.note}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Lịch sử thanh toán ({detail.payments.length})
                </h3>
                {detail.isMine && detail.status === 'open' && (
                  <button
                    onClick={() => setPaymentOpen(true)}
                    className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                  >
                    + Thêm
                  </button>
                )}
              </div>
              {detail.payments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Chưa có khoản thanh toán nào
                </div>
              ) : (
                <ul className="space-y-2">
                  {detail.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatVND(p.amount)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString('vi-VN')}
                          {p.note && ` · ${p.note}`}
                        </div>
                      </div>
                      {detail.isMine && (
                        <button
                          onClick={() => handleDeletePayment(p)}
                          className="ml-2 shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          🗑️
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border p-3">
              <button
                onClick={onClose}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Đóng
              </button>
            </div>
          </>
        )}

        {detail && (
          <PaymentFormModal
            open={paymentOpen}
            debtId={detail.id}
            remaining={detail.outstanding}
            onClose={() => setPaymentOpen(false)}
            onSaved={async () => {
              setPaymentOpen(false);
              await reload();
              onChanged();
            }}
          />
        )}
      </div>
    </div>
  );
}
