'use client';

import { useEffect, useState } from 'react';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import {
  deleteImportantDate,
  listThisMonth,
  notifyAiDate,
  testNotifyImportantDate,
} from '@/features/important-dates/api';
import { ImportantDateFormModal } from '@/features/important-dates/components/important-date-form-modal';
import { MonthItemCard } from '@/features/important-dates/components/month-item-card';
import type {
  ImportantDateView,
  MonthItem,
  MonthListView,
} from '@/features/important-dates/types';

const MONTH_LABEL_VI: Record<number, string> = {
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

export default function ImportantDatesPage() {
  const [view, setView] = useState<MonthListView | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantDateView | null>(null);

  async function reload() {
    try {
      const data = await listThisMonth();
      setView(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: MonthItem) {
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

  async function handleTest(item: MonthItem) {
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

  const monthLabel = view
    ? `${MONTH_LABEL_VI[view.month]} ${view.year}`
    : '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Ngày quan trọng"
        subtitle={view ? monthLabel : 'Đang tải…'}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Thêm ngày
          </button>
        }
      />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
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
                title={`Chưa có ngày quan trọng cho ${monthLabel}`}
                description="AI sẽ tự sinh danh sách vào đầu mỗi tháng. Trong lúc đó, bạn có thể tự thêm ngày."
              />
            </Card>
          )}

          {view !== null && view.items.length > 0 && (
            <div className="space-y-3">
              {view.items.map((item) => (
                <MonthItemCard
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
          )}
        </div>
      </main>

      <ImportantDateFormModal
        open={modalOpen}
        entry={editing}
        onClose={() => setModalOpen(false)}
        onSaved={(saved) => {
          void reload();
          const next = new Date(saved.nextOccurrence);
          const nextMonth = next.getUTCMonth() + 1;
          const nextYear = next.getUTCFullYear();
          if (
            view &&
            (nextMonth !== view.month || nextYear !== view.year)
          ) {
            alert(
              `Đã lưu — "${saved.name}" sẽ hiện trong ${MONTH_LABEL_VI[nextMonth]} ${nextYear}, không phải tháng đang xem.`,
            );
          }
        }}
      />
    </div>
  );
}
