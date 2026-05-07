'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import type { FundView } from '@/features/funds/types';
import {
  deleteTransaction,
  listTransactions,
} from '@/features/transactions/api';
import type { TransactionView } from '@/features/transactions/types';
import { useAuthedLayout } from '../layout';
import { EditTransactionModal } from '../_components/edit-transaction-modal';
import {
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from '../_components/ui';

const PAGE_SIZE = 30;

export default function TransactionsPage() {
  const { funds, reloadFunds } = useAuthedLayout();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [fundFilter, setFundFilter] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  const [items, setItems] = useState<TransactionView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editTxn, setEditTxn] = useState<TransactionView | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function changeFundFilter(v: string | 'all') {
    setFundFilter(v);
    setPage(0);
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    else if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
    setPage(0);
  }


  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    try {
      const res = await listTransactions({
        fundId: fundFilter === 'all' ? undefined : fundFilter,
        from: start.toISOString(),
        to: end.toISOString(),
        q: debouncedSearch.trim() || undefined,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [year, month, fundFilter, debouncedSearch, page]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ─── Stats (within current filter) ──────────────────────────────────
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of items) {
      if (t.category?.name === 'Chuyển nội bộ') continue;
      if (t.amount >= 0) income += t.amount;
      else expense += -t.amount;
    }
    return { income, expense, net: income - expense };
  }, [items]);

  // ─── Delete + edit handlers ─────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Xoá giao dịch này? Số dư quỹ sẽ được hoàn lại.')) return;
    try {
      await deleteTransaction(id);
      await Promise.all([reloadFunds(), fetchData()]);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      alert(`Không xoá được: ${msg}`);
    }
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const groupedItems = useMemo(() => groupByDay(items), [items]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Lịch sử giao dịch"
        subtitle={`${total} giao dịch · trang ${page + 1}/${Math.max(1, totalPages)}`}
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {/* Filter bar */}
          <Card padding="p-4">
            <div className="space-y-3">
              <FundFilterTabs
                funds={funds}
                value={fundFilter}
                onChange={changeFundFilter}
              />
              <div className="flex flex-wrap items-center gap-3">
                <MonthSwitcher
                  year={year}
                  month={month}
                  onShift={shiftMonth}
                  isCurrent={isCurrentMonth}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo ghi chú, category…"
                  className="min-w-[200px] flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm transition-colors placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Thu (trang này)"
              value={formatVND(stats.income)}
              tone="positive"
            />
            <StatCard
              label="Chi (trang này)"
              value={`−${formatVND(stats.expense)}`}
              tone="negative"
            />
            <StatCard
              label="Net"
              value={formatVND(stats.net, true)}
              tone={stats.net >= 0 ? 'positive' : 'negative'}
              hint="Đã loại Chuyển nội bộ"
            />
          </div>

          {/* List */}
          <Card>
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            )}
            {!loading && items.length === 0 && (
              <EmptyState
                icon="📭"
                title="Không có giao dịch khớp filter"
                description="Thử bỏ filter, đổi tháng, hoặc xoá search."
              />
            )}
            {!loading &&
              groupedItems.map(({ day, items }) => (
                <DayGroup
                  key={day}
                  day={day}
                  items={items}
                  onEdit={(t) => setEditTxn(t)}
                  onDelete={handleDelete}
                />
              ))}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              page={page}
              total={totalPages}
              onChange={setPage}
            />
          )}
        </div>
      </div>

      <EditTransactionModal
        open={editTxn !== null}
        txn={editTxn}
        funds={funds}
        onClose={() => setEditTxn(null)}
        onSaved={() => {
          void Promise.all([reloadFunds(), fetchData()]);
        }}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function FundFilterTabs({
  funds,
  value,
  onChange,
}: {
  funds: FundView[];
  value: string | 'all';
  onChange: (v: string | 'all') => void;
}) {
  const tabs: Array<
    { id: 'all' | string; label: string; icon: string; disabled?: boolean }
  > = [
    { id: 'all', label: 'Tất cả', icon: '📋' },
    ...funds.map((f) => ({
      id: f.id,
      label: f.name.replace('Quỹ ', ''),
      icon:
        f.accessLevel === 'private'
          ? '🔒'
          : f.type === 'joint'
            ? '🤝'
            : '💰',
      disabled: f.accessLevel === 'private',
    })),
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : t.disabled
                  ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-300'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        );
      })}
    </div>
  );
}

function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="rounded-md p-1.5 text-stone-600 transition-colors hover:bg-stone-100"
        aria-label="Tháng trước"
      >
        <Chevron dir="left" />
      </button>
      <div className="min-w-[120px] px-3 py-1 text-center text-sm font-medium text-stone-800">
        Tháng {month}/{year}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="rounded-md p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Tháng sau"
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
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
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}

interface DayGrouped {
  day: string;
  items: TransactionView[];
}

function groupByDay(items: TransactionView[]): DayGrouped[] {
  const buckets = new Map<string, TransactionView[]>();
  for (const t of items) {
    const day = t.date.slice(0, 10);
    if (!buckets.has(day)) buckets.set(day, []);
    buckets.get(day)!.push(t);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, items]) => ({ day, items }));
}

function DayGroup({
  day,
  items,
  onEdit,
  onDelete,
}: {
  day: string;
  items: TransactionView[];
  onEdit: (t: TransactionView) => void;
  onDelete: (id: string) => void;
}) {
  const dayLabel = formatDayLabel(day);
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between border-b border-stone-100 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {dayLabel}
        </span>
        <span className="text-[11px] text-stone-400">
          {items.length} giao dịch
        </span>
      </div>
      {items.map((t) => (
        <TxnRow
          key={t.id}
          t={t}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t.id)}
        />
      ))}
    </div>
  );
}

function TxnRow({
  t,
  onEdit,
  onDelete,
}: {
  t: TransactionView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isExpense = t.amount < 0;
  const isInternal = t.category?.name === 'Chuyển nội bộ';
  return (
    <div className="group flex items-center justify-between border-b border-stone-50 py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-base">
          {t.category?.icon ?? (isExpense ? '💸' : '💰')}
        </span>
        <div className="leading-tight">
          <div className="text-sm text-stone-800">
            {t.note ?? t.category?.name ?? '(không ghi chú)'}
          </div>
          <div className="text-[11px] text-stone-500">
            <span className="font-medium">{t.fund.name}</span>
            {t.category && ` · ${t.category.name}`}
            {' · '}
            {new Date(t.date).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' · '}
            <span className="text-stone-400">{t.loggedBy.name}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${
            isInternal
              ? 'text-stone-500'
              : isExpense
                ? 'text-rose-700'
                : 'text-emerald-700'
          }`}
        >
          {formatVND(t.amount, true)}
        </span>
        <div className="invisible flex items-center gap-1 group-hover:visible">
          <button
            onClick={onEdit}
            aria-label="Sửa"
            title="Sửa quỹ / số tiền / category"
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            aria-label="Xoá"
            title="Xoá + hoàn lại số dư"
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ← Trước
      </button>
      <span className="text-xs text-stone-500">
        Trang {page + 1} / {total}
      </span>
      <button
        onClick={() => onChange(Math.min(total - 1, page + 1))}
        disabled={page >= total - 1}
        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Tiếp →
      </button>
    </div>
  );
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (+d === +today) return 'Hôm nay';
  if (+d === +yesterday) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
