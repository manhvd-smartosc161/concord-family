'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { FundFilterTabs } from '@/features/funds/components/fund-filter-tabs';
import {
  deleteTransaction,
  listTransactions,
} from '@/features/transactions/api';
import type { TransactionView } from '@/features/transactions/types';
import { groupByDay } from '@/features/transactions/lib/group-by-day';
import { DayGroup } from '@/features/transactions/components/day-group';
import { MonthSwitcher } from '@/features/transactions/components/month-switcher';
import { Pagination } from '@/features/transactions/components/pagination';
import { EditTransactionModal } from '@/features/transactions/components/edit-transaction-modal';
import { useAuthedLayout } from '../layout';
import {
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/components/ui';

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
        scope: fundFilter === 'all' ? 'joint' : 'all',
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
