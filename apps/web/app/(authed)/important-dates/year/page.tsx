'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import {
  deleteImportantDate,
  listForYear,
  notifyAiDate,
  testNotifyImportantDate,
} from '@/features/important-dates/api';
import { AgendaItemCard } from '@/features/important-dates/components/agenda-item-card';
import { ImportantDateFormModal } from '@/features/important-dates/components/important-date-form-modal';
import type {
  AgendaItem,
  ImportantDateView,
  YearAgendaView,
} from '@/features/important-dates/types';

const MONTH_VI: Record<number, string> = {
  1: 'Tháng 1',
  2: 'Tháng 2',
  3: 'Tháng 3',
  4: 'Tháng 4',
  5: 'Tháng 5',
  6: 'Tháng 6',
  7: 'Tháng 7',
  8: 'Tháng 8',
  9: 'Tháng 9',
  10: 'Tháng 10',
  11: 'Tháng 11',
  12: 'Tháng 12',
};

const MONTH_HUE: Record<number, string> = {
  1: 'from-rose-300 to-rose-500',
  2: 'from-pink-300 to-rose-500',
  3: 'from-amber-300 to-orange-500',
  4: 'from-amber-300 to-emerald-500',
  5: 'from-emerald-300 to-emerald-600',
  6: 'from-emerald-400 to-sky-500',
  7: 'from-sky-300 to-sky-600',
  8: 'from-sky-300 to-indigo-500',
  9: 'from-indigo-300 to-violet-500',
  10: 'from-violet-300 to-fuchsia-500',
  11: 'from-amber-400 to-rose-500',
  12: 'from-rose-400 to-rose-600',
};

type KindFilter = 'all' | 'birthday' | 'death_anniversary' | 'anniversary' | 'other';

const FILTER_OPTIONS: { value: KindFilter; icon: string; label: string }[] = [
  { value: 'all', icon: '📋', label: 'Tất cả' },
  { value: 'birthday', icon: '🎂', label: 'Sinh nhật' },
  { value: 'death_anniversary', icon: '🕯', label: 'Giỗ' },
  { value: 'anniversary', icon: '💑', label: 'Kỷ niệm' },
  { value: 'other', icon: '📅', label: 'Khác / lễ' },
];

function matchesFilter(item: AgendaItem, filter: KindFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'other') {
    return (
      item.kind === 'other' ||
      item.source === 'ai'
    );
  }
  return item.kind === filter;
}

export default function YearAgendaPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [view, setView] = useState<YearAgendaView | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantDateView | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');

  async function reload() {
    setView(null);
    try {
      const data = await listForYear(year);
      setView(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const filteredItems = useMemo(() => {
    if (!view) return [] as AgendaItem[];
    return view.items.filter((i) => matchesFilter(i, kindFilter));
  }, [view, kindFilter]);

  const grouped = useMemo(() => {
    const map = new Map<number, AgendaItem[]>();
    for (const item of filteredItems) {
      const m = parseInt(item.occursOn.slice(5, 7), 10);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(item);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, items]) => ({ month, items }));
  }, [filteredItems]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: AgendaItem) {
    if (!item.sourceId) return;
    setEditing({
      id: item.sourceId,
      name: item.name,
      type:
        item.kind === 'birthday' ||
        item.kind === 'death_anniversary' ||
        item.kind === 'anniversary' ||
        item.kind === 'other'
          ? item.kind
          : 'other',
      date: item.occursOn,
      isLunar: item.isLunar,
      remindDaysBefore: item.remindDaysBefore,
      notes: item.notes,
      createdById: '',
      nextOccurrence: item.occursOn,
      daysUntilNext: item.daysUntil,
    });
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Xoá ngày này?')) return;
    try {
      await deleteImportantDate(id);
      await reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleTest(item: AgendaItem) {
    try {
      if (item.source === 'user' && item.sourceId) {
        await testNotifyImportantDate(item.sourceId);
      } else {
        await notifyAiDate(item.name, item.occursOn, item.kind, item.notes);
      }
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const total = view?.items.length ?? 0;
  const filteredCount = filteredItems.length;
  const subtitleText = !view
    ? 'Đang tải…'
    : kindFilter === 'all'
      ? `${total} sự kiện sắp tới — group theo tháng`
      : `${filteredCount}/${total} sự kiện (đang lọc)`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={`Cả năm ${year}`}
        subtitle={subtitleText}
        actions={
          <div className="flex items-center gap-2">
            {year > currentYear && (
              <button
                type="button"
                onClick={() => setYear(year - 1)}
                className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                title="Năm trước"
              >
                ← {year - 1}
              </button>
            )}
            <button
              type="button"
              onClick={() => setYear(year + 1)}
              className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
              title="Năm sau"
            >
              {year + 1} →
            </button>
            <Link
              href="/important-dates"
              className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            >
              Sắp tới
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              + Thêm ngày
            </button>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/30 via-stone-50 to-stone-50 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="-mx-3 mb-5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className="flex gap-2 whitespace-nowrap">
              {FILTER_OPTIONS.map((opt) => {
                const active = kindFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKindFilter(opt.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {view === null && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {view !== null && view.items.length === 0 && (
            <Card>
              <EmptyState
                icon="📅"
                title={`Chưa có sự kiện sắp tới cho ${year}`}
                description="AI sẽ tự sinh khi cron đầu năm chạy. Bạn cũng có thể tự thêm ngày."
              />
            </Card>
          )}

          {view !== null &&
            view.items.length > 0 &&
            filteredItems.length === 0 && (
              <Card>
                <EmptyState
                  icon="🔍"
                  title="Không có sự kiện khớp filter"
                  description="Đổi loại khác hoặc bấm 'Tất cả' để xem hết."
                />
              </Card>
            )}

          <div className="space-y-12">
            {grouped.map(({ month, items }) => (
              <section key={month}>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div className="flex items-end gap-3">
                    <div className="relative">
                      <div
                        className={`absolute -inset-1 rounded-full bg-gradient-to-br ${MONTH_HUE[month]} opacity-30 blur-md`}
                      />
                      <div
                        className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${MONTH_HUE[month]} font-mono text-base font-bold tabular-nums text-white shadow-sm`}
                      >
                        {String(month).padStart(2, '0')}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-stone-900">
                        {MONTH_VI[month]}
                      </h2>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                        {items.length} sự kiện · {String(month).padStart(2, '0')}/{year}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`hidden h-px flex-1 self-end bg-gradient-to-r ${MONTH_HUE[month]} opacity-30 md:block`}
                    style={{ marginBottom: 8 }}
                  />
                </div>
                <div className="space-y-4">
                  {items.map((item) => (
                    <AgendaItemCard
                      key={`${item.source}-${item.sourceId ?? item.name}-${item.occursOn}`}
                      item={item}
                      onEdit={() => openEdit(item)}
                      onDelete={() =>
                        item.sourceId && handleDelete(item.sourceId)
                      }
                      onTest={() => handleTest(item)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <ImportantDateFormModal
        open={modalOpen}
        entry={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void reload();
        }}
      />
    </div>
  );
}
