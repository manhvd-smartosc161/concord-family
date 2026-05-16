# Debts — Frontend + AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Backend Plan 1 ([docs/superpowers/plans/2026-05-16-debts-backend.md](2026-05-16-debts-backend.md)) is fully implemented and `/api/debts/*` endpoints work via curl.

**Goal:** Build frontend feature slice + page + sidebar entry + i18n cho debts. Tích hợp AI chat: parser tạo `debt_proposed` và `debt_payment_proposed` actions, chat page render action cards có combobox match + form, confirm → tạo Transaction + Payment.

**Architecture:** Feature slice `apps/web/features/debts/` (api + types + components) theo Concord pattern. Page `/debts` compose KPI + filter + grouped list. Chat AI: update parser subagent (markdown skill file) + extend `ParseAction` types + render new action cards trong `apps/web/app/(authed)/chat/page.tsx`.

**Tech Stack:** NextJS 16 App Router + React 19 + Tailwind v4 + lucide-react, AI Anthropic SDK (Haiku 4.5 parser).

**Spec:** [docs/superpowers/specs/2026-05-16-debts-design.md](../specs/2026-05-16-debts-design.md)

---

## File map

**Create**:
- `apps/web/features/debts/api.ts`
- `apps/web/features/debts/types.ts`
- `apps/web/features/debts/components/debt-card.tsx`
- `apps/web/features/debts/components/debt-list.tsx`
- `apps/web/features/debts/components/debt-form-modal.tsx`
- `apps/web/features/debts/components/debt-detail-modal.tsx`
- `apps/web/features/debts/components/payment-form-modal.tsx`
- `apps/web/app/(authed)/debts/page.tsx`

**Modify**:
- `apps/web/components/layout/sidebar.tsx` — add NAV entry
- `apps/web/messages/vi.json` + `en.json` — add `debts` namespace + `nav.debts`
- `apps/web/app/(authed)/chat/page.tsx` — render new action card kinds
- `apps/web/features/chat/types.ts` (or wherever `ParseAction` lives) — extend union
- `apps/api/src/agent/subagents/parser/skill.md` (or similar parser prompt file) — teach AI to emit new actions

---

## Phase 1 — Feature slice foundation

### Task 1: Types + API client

**Files:**
- Create: `apps/web/features/debts/types.ts`
- Create: `apps/web/features/debts/api.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
export type DebtDirection = 'i_owe' | 'they_owe_me';
export type DebtVisibility = 'private' | 'shared';
export type DebtStatus = 'open' | 'closed';

export interface DebtView {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  outstanding: number;
  visibility: DebtVisibility;
  dueDate: string | null;
  note: string | null;
  status: DebtStatus;
  ownerId: string;
  isMine: boolean;
  createdAt: string;
  closedAt: string | null;
}

export interface DebtPaymentView {
  id: string;
  debtId: string;
  transactionId: string | null;
  amount: number;
  paidAt: string;
  note: string | null;
}

export interface DebtDetail extends DebtView {
  payments: DebtPaymentView[];
}

export interface DebtMatch {
  id: string;
  counterparty: string;
  outstanding: number;
  direction: DebtDirection;
  score: number;
}

export interface CreateDebtPayload {
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  visibility?: DebtVisibility;
  dueDate?: string | null;
  note?: string | null;
}

export interface UpdateDebtPayload {
  counterparty?: string;
  principal?: number;
  visibility?: DebtVisibility;
  dueDate?: string | null;
  note?: string | null;
}

export interface CreatePaymentPayload {
  amount: number;
  paidAt: string;
  transactionId?: string;
  note?: string;
}

export interface ListDebtsFilter {
  status?: DebtStatus;
  direction?: DebtDirection;
  visibility?: DebtVisibility;
}
```

- [ ] **Step 2: Create `api.ts`**

```ts
import { apiFetch } from '@/lib/api-client';
import type {
  CreateDebtPayload,
  CreatePaymentPayload,
  DebtDetail,
  DebtMatch,
  DebtPaymentView,
  DebtView,
  ListDebtsFilter,
  UpdateDebtPayload,
} from './types';

function buildQuery(filter: ListDebtsFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.direction) params.set('direction', filter.direction);
  if (filter.visibility) params.set('visibility', filter.visibility);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function listDebts(filter: ListDebtsFilter = {}): Promise<DebtView[]> {
  return apiFetch<DebtView[]>(`/api/debts${buildQuery(filter)}`);
}

export function getDebt(id: string): Promise<DebtDetail> {
  return apiFetch<DebtDetail>(`/api/debts/${id}`);
}

export function createDebt(payload: CreateDebtPayload): Promise<DebtView> {
  return apiFetch<DebtView>('/api/debts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDebt(id: string, payload: UpdateDebtPayload): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteDebt(id: string): Promise<void> {
  return apiFetch<void>(`/api/debts/${id}`, { method: 'DELETE' });
}

export function closeDebt(id: string): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}/close`, { method: 'POST' });
}

export function reopenDebt(id: string): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}/reopen`, { method: 'POST' });
}

export function createPayment(
  debtId: string,
  payload: CreatePaymentPayload,
): Promise<DebtPaymentView> {
  return apiFetch<DebtPaymentView>(`/api/debts/${debtId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePayment(debtId: string, paymentId: string): Promise<void> {
  return apiFetch<void>(`/api/debts/${debtId}/payments/${paymentId}`, {
    method: 'DELETE',
  });
}

export function matchDebts(
  counterparty: string,
  direction?: 'i_owe' | 'they_owe_me',
): Promise<DebtMatch[]> {
  return apiFetch<DebtMatch[]>('/api/debts/match', {
    method: 'POST',
    body: JSON.stringify({ counterparty, direction }),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/debts/api.ts apps/web/features/debts/types.ts
git commit -m "feat(web): add debts feature types + api client"
```

---

### Task 2: DebtCard component

**Files:**
- Create: `apps/web/features/debts/components/debt-card.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client';

import { formatVND } from '@/lib/format';
import type { DebtView } from '../types';

export function DebtCard({
  debt,
  onClick,
}: {
  debt: DebtView;
  onClick: () => void;
}) {
  const isOwe = debt.direction === 'i_owe';
  const accentBg = isOwe
    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900';
  const accentText = isOwe ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300';

  let dueLabel: string | null = null;
  if (debt.dueDate) {
    const due = new Date(debt.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) dueLabel = `Quá hạn ${-diffDays} ngày`;
    else if (diffDays === 0) dueLabel = 'Đến hạn hôm nay';
    else dueLabel = `Còn ${diffDays} ngày`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted ${accentBg}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {debt.counterparty}
          </span>
          {debt.visibility === 'private' && (
            <span title="Riêng tư">🔒</span>
          )}
          {debt.visibility === 'shared' && (
            <span title="Cả nhà thấy">👥</span>
          )}
          {debt.status === 'closed' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Đã đóng
            </span>
          )}
        </div>
        {(dueLabel || debt.note) && (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {dueLabel}
            {dueLabel && debt.note && ' · '}
            {debt.note}
          </div>
        )}
      </div>
      <div className={`ml-3 shrink-0 text-right font-mono text-base font-semibold tabular-nums ${accentText}`}>
        {formatVND(debt.outstanding)}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/debts/components/debt-card.tsx
git commit -m "feat(web): add DebtCard component"
```

---

### Task 3: DebtFormModal component

**Files:**
- Create: `apps/web/features/debts/components/debt-form-modal.tsx`

- [ ] **Step 1: Create component**

```tsx
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
        setPrincipal(String(initial.principal));
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
      const amount = parseInt(principal, 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Số tiền không hợp lệ');
      }
      const payload = {
        counterparty: counterparty.trim(),
        principal: amount,
        visibility,
        dueDate: dueDate || null,
        note: note.trim() || null,
      };
      const saved = initial
        ? await updateDebt(initial.id, payload)
        : await createDebt({ ...payload, direction });
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
              type="number"
              min="1"
              step="1"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/debts/components/debt-form-modal.tsx
git commit -m "feat(web): add DebtFormModal"
```

---

### Task 4: PaymentFormModal component

**Files:**
- Create: `apps/web/features/debts/components/payment-form-modal.tsx`

- [ ] **Step 1: Create component**

```tsx
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
      const amt = parseInt(amount, 10);
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
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/debts/components/payment-form-modal.tsx
git commit -m "feat(web): add PaymentFormModal"
```

---

### Task 5: DebtDetailModal component

**Files:**
- Create: `apps/web/features/debts/components/debt-detail-modal.tsx`

- [ ] **Step 1: Create component**

```tsx
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
                      className="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60"
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
                <h3 className="text-sm font-medium text-foreground">Lịch sử thanh toán ({detail.payments.length})</h3>
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
                          {p.transactionId === null && p.transactionId !== undefined && ' · (giao dịch đã xóa)'}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/debts/components/debt-detail-modal.tsx
git commit -m "feat(web): add DebtDetailModal"
```

---

## Phase 2 — Page + Sidebar + i18n

### Task 6: Add i18n entries

**Files:**
- Modify: `apps/web/messages/vi.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Read both files to locate `nav` namespace**

Run: `grep -n '"nav"' apps/web/messages/vi.json apps/web/messages/en.json`

- [ ] **Step 2: Add `nav.debts` key**

Inside `nav` namespace in both `vi.json` and `en.json`, add:
- vi: `"debts": "Nợ & Cho vay"`
- en: `"debts": "Debts & Loans"`

- [ ] **Step 3: Add `debts` namespace at top level**

In `vi.json`, after an existing top-level namespace (e.g. `goals`):

```json
"debts": {
  "title": "Nợ & Cho vay",
  "subtitle_template": "{owe} đang nợ · {lent} đang cho vay",
  "kpi_i_owe": "Tôi đang nợ",
  "kpi_they_owe": "Người ta nợ tôi",
  "kpi_net": "Net",
  "filter_status_all": "Tất cả trạng thái",
  "filter_status_open": "Đang mở",
  "filter_status_closed": "Đã đóng",
  "filter_direction_all": "Tất cả hướng",
  "filter_direction_i_owe": "💳 Tôi nợ",
  "filter_direction_they_owe": "🤝 Cho vay",
  "section_i_owe": "💳 Tôi đang nợ",
  "section_they_owe_me": "🤝 Đang cho vay",
  "empty_open": "Chưa có khoản nào đang mở",
  "empty_closed": "Chưa có khoản nào đã đóng",
  "add_button": "+ Thêm khoản nợ/cho vay"
}
```

In `en.json`:

```json
"debts": {
  "title": "Debts & Loans",
  "subtitle_template": "{owe} owed · {lent} lent",
  "kpi_i_owe": "I owe",
  "kpi_they_owe": "Owed to me",
  "kpi_net": "Net",
  "filter_status_all": "All statuses",
  "filter_status_open": "Open",
  "filter_status_closed": "Closed",
  "filter_direction_all": "All directions",
  "filter_direction_i_owe": "💳 I owe",
  "filter_direction_they_owe": "🤝 Lent out",
  "section_i_owe": "💳 I owe",
  "section_they_owe_me": "🤝 Lent out",
  "empty_open": "No open debts",
  "empty_closed": "No closed debts",
  "add_button": "+ Add debt/loan"
}
```

Verify JSON validity:
```bash
python3 -c "import json; json.load(open('apps/web/messages/vi.json'))"
python3 -c "import json; json.load(open('apps/web/messages/en.json'))"
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/vi.json apps/web/messages/en.json
git commit -m "feat(web): i18n for debts feature"
```

---

### Task 7: Add sidebar entry

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Read the file to find `NAV` array**

Run: `grep -n "NAV\|Tiết kiệm\|envelopes" apps/web/components/layout/sidebar.tsx | head -20`

- [ ] **Step 2: Add entry after "Tiết kiệm & Đầu tư"**

In the NAV array, find the entry for goals/envelopes (Tiết kiệm). After it, add:

```ts
{ key: 'debts', icon: '💳', labelKey: 'debts', href: '/debts' },
```

(Adapt the exact field names — `key`, `icon`, `labelKey`, `href` — to match what the existing entries use. Read the file first if uncertain.)

The entry should appear in the same group as Tiết kiệm & Đầu tư (Tài chính group).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): add Debts entry to sidebar"
```

---

### Task 8: Debts page

**Files:**
- Create: `apps/web/app/(authed)/debts/page.tsx`

- [ ] **Step 1: Create page**

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { listDebts } from '@/features/debts/api';
import { DebtCard } from '@/features/debts/components/debt-card';
import { DebtDetailModal } from '@/features/debts/components/debt-detail-modal';
import { DebtFormModal } from '@/features/debts/components/debt-form-modal';
import type { DebtDirection, DebtStatus, DebtView } from '@/features/debts/types';
import { formatVND } from '@/lib/format';

export default function DebtsPage() {
  const t = useTranslations('debts');
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DebtStatus | ''>('open');
  const [direction, setDirection] = useState<DebtDirection | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DebtView | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listDebts({
        status: status || undefined,
        direction: direction || undefined,
      });
      setDebts(list);
    } finally {
      setLoading(false);
    }
  }, [status, direction]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(() => {
    const iOwe = debts.filter((d) => d.direction === 'i_owe');
    const theyOwe = debts.filter((d) => d.direction === 'they_owe_me');
    return { iOwe, theyOwe };
  }, [debts]);

  const kpi = useMemo(() => {
    const owe = groups.iOwe.filter((d) => d.status === 'open').reduce((s, d) => s + d.outstanding, 0);
    const lent = groups.theyOwe.filter((d) => d.status === 'open').reduce((s, d) => s + d.outstanding, 0);
    return { owe, lent, net: lent - owe };
  }, [groups]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle_template', {
          owe: String(groups.iOwe.filter((d) => d.status === 'open').length),
          lent: String(groups.theyOwe.filter((d) => d.status === 'open').length),
        })}
        action={
          <button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t('add_button')}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={t('kpi_i_owe')} value={formatVND(kpi.owe)} tone="negative" />
            <StatCard label={t('kpi_they_owe')} value={formatVND(kpi.lent)} tone="positive" />
            <StatCard
              label={t('kpi_net')}
              value={formatVND(kpi.net, true)}
              tone={kpi.net >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <Card padding="p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DebtStatus | '')}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="open">{t('filter_status_open')}</option>
                <option value="closed">{t('filter_status_closed')}</option>
                <option value="">{t('filter_status_all')}</option>
              </select>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as DebtDirection | '')}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">{t('filter_direction_all')}</option>
                <option value="i_owe">{t('filter_direction_i_owe')}</option>
                <option value="they_owe_me">{t('filter_direction_they_owe')}</option>
              </select>
            </div>
          </Card>

          {loading ? (
            <Card padding="p-6">
              <div className="text-center text-sm text-muted-foreground">Đang tải…</div>
            </Card>
          ) : (
            <>
              {(direction === '' || direction === 'i_owe') && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground">{t('section_i_owe')}</h2>
                  {groups.iOwe.length === 0 ? (
                    <EmptyState title={status === 'closed' ? t('empty_closed') : t('empty_open')} />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {groups.iOwe.map((d) => (
                        <DebtCard key={d.id} debt={d} onClick={() => setDetailId(d.id)} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {(direction === '' || direction === 'they_owe_me') && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground">{t('section_they_owe_me')}</h2>
                  {groups.theyOwe.length === 0 ? (
                    <EmptyState title={status === 'closed' ? t('empty_closed') : t('empty_open')} />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {groups.theyOwe.map((d) => (
                        <DebtCard key={d.id} debt={d} onClick={() => setDetailId(d.id)} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <DebtFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await reload();
        }}
      />

      <DebtDetailModal
        open={detailId !== null}
        debtId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(d) => {
          setDetailId(null);
          setEditTarget(d);
          setFormOpen(true);
        }}
        onChanged={() => void reload()}
      />
    </div>
  );
}
```

If `PageHeader` doesn't support `action` prop, adapt: place the button as a sibling above the main content area instead.

- [ ] **Step 2: Verify dev compiles**

Run: `pnpm --filter web dev` background. Navigate to http://localhost:3000/debts after login.
Expected: page renders with empty state.

Stop dev server.

- [ ] **Step 3: Manual smoke test**

Click "+ Thêm" → fill form → save → card appears.
Click card → detail modal opens → click "+ Thêm" payment → fill → save → outstanding decreases.
Pay off → status → closed.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(authed)/debts/page.tsx"
git commit -m "feat(web): add Debts page (/debts)"
```

---

## Phase 3 — AI Chat Integration

### Task 9: Locate parser action types

**Files:** read-only inspection

- [ ] **Step 1: Find ParseAction type definition**

Run:
```bash
grep -rn "ParseAction\|kind:.*'important_date" apps/web apps/api --include="*.ts" --include="*.tsx" | head -20
```

Identify:
1. Where the `ParseAction` discriminated union is declared (likely `apps/api/src/agent/...` and possibly mirrored in `apps/web/features/chat/types.ts`).
2. Where the parser subagent system prompt lives (likely `apps/api/src/agent/subagents/parser/skill.md` or similar `.md` file).

Note the exact file paths for use in subsequent tasks.

- [ ] **Step 2: Read both locations**

Read those files end-to-end to understand pattern. Note:
- How existing actions are encoded (kind, shape, validation)
- How frontend renders action cards (`apps/web/app/(authed)/chat/page.tsx` switch on `action.kind`)

No commit (read only).

---

### Task 10: Extend ParseAction types

**Files:**
- Modify: backend ParseAction definition (path from Task 9)
- Modify: frontend mirror (if separate file)

- [ ] **Step 1: Add new action shapes to backend types**

Append to the union:

```ts
| {
    kind: 'debt_proposed';
    direction: 'i_owe' | 'they_owe_me';
    counterparty: string;
    principal: number;
    fundId: string | null;
    raw: string;
  }
| {
    kind: 'debt_payment_proposed';
    debtMatches: Array<{ id: string; counterparty: string; outstanding: number; score: number }>;
    direction: 'i_owe' | 'they_owe_me';
    amount: number;
    fundId: string;
    paidAt: string;
    raw: string;
  }
```

- [ ] **Step 2: Add same shapes to frontend mirror**

If frontend has its own `ParseAction` mirror (likely in `apps/web/features/chat/types.ts`), append identical shapes.

- [ ] **Step 3: Commit**

```bash
git add <files>
git commit -m "feat: extend ParseAction with debt_proposed + debt_payment_proposed"
```

---

### Task 11: Update parser subagent prompt

**Files:**
- Modify: parser subagent skill markdown (path from Task 9)

- [ ] **Step 1: Add action kinds to output schema section**

In the parser prompt, find the section listing existing `kind` enum values. Add:

```
- "debt_proposed" — user mentions taking out a loan or someone borrowing from them. Emit shape:
  { kind: "debt_proposed", direction, counterparty, principal, fundId, raw }
- "debt_payment_proposed" — user mentions paying off a debt or receiving a repayment. Emit shape:
  { kind: "debt_payment_proposed", direction, amount, fundId, paidAt, raw }
  (debtMatches array will be populated server-side via /api/debts/match — do NOT fabricate ids in this kind)
```

- [ ] **Step 2: Add Vietnamese examples**

Append 3-4 example exchanges:

```
User: "Trả thẻ Sacombank 2 triệu bằng quỹ riêng"
Output: {
  "actions": [{
    "kind": "debt_payment_proposed",
    "direction": "i_owe",
    "amount": 2000000,
    "fundId": "<user's personal fund id from context>",
    "paidAt": "<now ISO>",
    "raw": "Trả thẻ Sacombank 2 triệu bằng quỹ riêng"
  }]
}

User: "Vừa vay anh Tuấn 5 triệu mua xe, để vào quỹ Mạnh"
Output: {
  "actions": [{
    "kind": "debt_proposed",
    "direction": "i_owe",
    "counterparty": "Anh Tuấn",
    "principal": 5000000,
    "fundId": "<personal fund id>",
    "raw": "Vừa vay anh Tuấn 5 triệu mua xe, để vào quỹ Mạnh"
  }]
}

User: "Em Hằng vay 3 triệu, đã trả 1 lần 500k tuần trước"
Output: {
  "actions": [
    {
      "kind": "debt_proposed",
      "direction": "they_owe_me",
      "counterparty": "Em Hằng",
      "principal": 3000000,
      "fundId": null,
      "raw": "Em Hằng vay 3 triệu"
    }
    // Note: the second clause (đã trả 500k) cannot be linked without a debt id — let the user re-mention or do via manual UI.
  ]
}

User: "Em Hằng vừa trả 1 triệu" (after debt exists)
Output: {
  "actions": [{
    "kind": "debt_payment_proposed",
    "direction": "they_owe_me",
    "amount": 1000000,
    "fundId": "<joint or personal fund per context>",
    "paidAt": "<now>",
    "raw": "Em Hằng vừa trả 1 triệu"
  }]
}
```

- [ ] **Step 3: Hint heuristic**

In a "Hints" or "When to emit" section, add:

```
If the user mentions: "thẻ tín dụng", "thẻ <bank name>", "vay <name>", "cho vay", "trả nợ", "trả thẻ", "<name> vay", "<name> nợ", "<name> trả" — consider emitting a debt-related action.
Distinguish create-debt vs payment by verb: "vay/cho vay" → debt_proposed; "trả/đã trả/nhận trả" → debt_payment_proposed.
```

- [ ] **Step 4: Commit**

```bash
git add <parser-skill.md path>
git commit -m "feat(api): teach parser subagent to emit debt actions"
```

---

### Task 12: Server-side enrich debt_payment_proposed with matches

**Files:**
- Modify: wherever parser output is post-processed (likely in chat service that calls subagent — find via `grep -rn "ParseAction\|parseActions" apps/api/src/modules/chat/`)

- [ ] **Step 1: Find chat service that processes parser output**

Run: `grep -rn "actions\|kind === " apps/api/src/modules/chat/ | head -20`

Identify the method that runs after the parser subagent returns. This is where we'll enrich the `debt_payment_proposed` action with `debtMatches`.

- [ ] **Step 2: Inject DebtsMatchService**

Open the chat service module file. Add `DebtsMatchService` to its constructor injection. Update the chat module's `imports` to include `DebtsModule`.

- [ ] **Step 3: Enrich actions**

In the action post-processing step (after parser returns):

```ts
for (let i = 0; i < actions.length; i++) {
  const a = actions[i];
  if (a.kind === 'debt_payment_proposed') {
    // We need counterparty to match — parser MIGHT include it or not.
    // For MVP: if action has a "raw" string, extract counterparty by regex,
    // OR pass an extra "counterpartyHint" field added by parser.
    // Simplest: call match with the raw text and let trigram do the work.
    const matches = await this.debtsMatchService.matchCounterparty(
      user,
      a.raw,
      a.direction,
    );
    a.debtMatches = matches;
  }
}
```

If parser-side: better to emit `counterpartyHint: string` field on the action. Update parser prompt + types to include it, and use that for matching. This is cleaner — do it this way:

In Task 10, ensure `debt_payment_proposed` shape includes `counterpartyHint: string` field. Update parser prompt to emit the inferred counterparty name. Then enrich:

```ts
const matches = await this.debtsMatchService.matchCounterparty(
  user,
  a.counterpartyHint,
  a.direction,
);
a.debtMatches = matches;
```

- [ ] **Step 4: Commit**

```bash
git add <chat service files>
git commit -m "feat(api): enrich debt_payment_proposed actions with fuzzy matches"
```

---

### Task 13: Render debt action cards in chat

**Files:**
- Modify: `apps/web/app/(authed)/chat/page.tsx`

- [ ] **Step 1: Find the ActionCard render switch**

Run: `grep -n "action.kind\|case '" "apps/web/app/(authed)/chat/page.tsx" | head -20`

Identify the switch/if-chain that renders different action kinds.

- [ ] **Step 2: Add render cases**

Add two new cases. Sketch (adapt to existing pattern — likely a component or inline JSX block per kind):

For `debt_proposed`:
```tsx
if (action.kind === 'debt_proposed') {
  return (
    <DebtProposeCard
      action={action}
      onConfirm={async (final) => {
        const debt = await createDebt({
          direction: final.direction,
          counterparty: final.counterparty,
          principal: final.principal,
        });
        if (final.fundId) {
          await createTransaction({
            fundId: final.fundId,
            amount: final.direction === 'i_owe' ? final.principal : -final.principal,
            categoryId: final.categoryId,
            note: `${final.direction === 'i_owe' ? 'Vay từ' : 'Cho vay'} ${final.counterparty}`,
            date: new Date().toISOString(),
          });
        }
        // mark this action as handled in chat state
      }}
      onDismiss={() => {/* mark dismissed */}}
    />
  );
}
```

For `debt_payment_proposed`:
```tsx
if (action.kind === 'debt_payment_proposed') {
  return (
    <DebtPaymentProposeCard
      action={action}
      onConfirm={async (final) => {
        // final.debtId either picked from action.debtMatches or null (= create new)
        let debtId = final.debtId;
        if (!debtId) {
          const newDebt = await createDebt({
            direction: final.direction,
            counterparty: final.counterpartyName,
            principal: final.amount,
          });
          debtId = newDebt.id;
        }
        const txn = await createTransaction({
          fundId: final.fundId,
          amount: final.direction === 'i_owe' ? -final.amount : final.amount,
          categoryId: final.categoryId,
          note: `Trả ${final.counterpartyName}`,
          date: final.paidAt,
        });
        await createPayment(debtId, {
          amount: final.amount,
          paidAt: final.paidAt,
          transactionId: txn.id,
        });
      }}
      onDismiss={() => {/* mark dismissed */}}
    />
  );
}
```

- [ ] **Step 3: Create the two card components inline (or in `features/chat/components/`)**

Create or extend with two sub-components. Each shows:

`DebtProposeCard`:
- Header "💳 Khoản vay mới?" or "🤝 Cho vay?"
- Counterparty (read-only or editable)
- Principal (read-only formatted)
- Fund select (dropdown)
- Confirm/Dismiss buttons

`DebtPaymentProposeCard`:
- Header "💳 Trả nợ?" or "🤝 Nhận trả nợ?"
- Combobox: action.debtMatches[0..1] entries + "+ Tạo mới" option
  - If user picks existing: show counterparty + outstanding inline
  - If "+ Tạo mới": show counterparty input
- Amount (editable, default from action.amount)
- Fund select (default action.fundId)
- Confirm/Dismiss

Use existing chat action card visual style (see how other action cards are rendered — emerald accent for confirm, neutral for dismiss).

- [ ] **Step 4: Smoke test**

Run dev: `pnpm dev`.

In chat (private mode) type: "Vừa trả thẻ Sacombank 2 triệu". Wait for action card. Click Confirm. Verify in /transactions a new expense appeared and in /debts the debt outstanding decreased.

Type: "Anh A vay tôi 1 triệu". Confirm. Verify new debt appears in /debts with direction `they_owe_me`.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(authed)/chat/page.tsx" apps/web/features/chat/ apps/web/features/debts/
git commit -m "feat(web): render debt action cards in chat + wire confirm flow"
```

---

## Phase 4 — QA & Polish

### Task 14: End-to-end QA pass

**Files:** none

- [ ] **Step 1: Functional QA**

- [ ] Create debt manual via /debts → appears
- [ ] Add payment manual → outstanding decreases, status open
- [ ] Pay off completely → status auto = closed
- [ ] Delete payment → outstanding restored, status reopened
- [ ] Edit debt counterparty → updates
- [ ] Delete debt → cascade payments → list refreshes
- [ ] Private debt by user A → not visible to user B (same family)
- [ ] Shared debt → visible to both, edit only by owner

- [ ] **Step 2: AI flow QA**

- [ ] Existing debt + "trả X" chat → matches found in card combobox
- [ ] Wrong typo "thẻ sacombnak" → fuzzy match still finds it (score might be low — verify threshold)
- [ ] No existing debt + "vay X" → card shows + tạo mới flow → confirm creates debt
- [ ] Confirm creates BOTH transaction and payment (verify in /transactions + /debts)
- [ ] Dismiss action card → no DB writes

- [ ] **Step 3: Dark mode QA**

Toggle dark — verify /debts page, all modals, action cards render correctly in dark.

- [ ] **Step 4: Mobile viewport**

DevTools mobile emulator — page renders, KPI cards stack, filter dropdowns usable, modals fit.

- [ ] **Step 5: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix(debts): QA pass adjustments"
```

---

## Definition of Done

- [ ] `/debts` page with KPI, filters, grouped list
- [ ] Sidebar entry in "Tài chính" group
- [ ] i18n entries (vi + en)
- [ ] DebtFormModal, DebtDetailModal, PaymentFormModal all functional
- [ ] Privacy enforced: private vs shared
- [ ] Chat AI: parser emits debt_proposed + debt_payment_proposed
- [ ] Chat AI: server enriches with fuzzy matches
- [ ] Chat AI: confirm flow creates Transaction + Payment + Debt as needed
- [ ] Dark mode looks good on /debts
- [ ] No TS errors, dev server compiles clean
