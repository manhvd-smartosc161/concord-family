'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import {
  deleteImportantDate,
  listUpcoming,
  notifyAiDate,
  testNotifyImportantDate,
} from '@/features/important-dates/api';
import { AgendaItemCard } from '@/features/important-dates/components/agenda-item-card';
import { ImportantDateFormModal } from '@/features/important-dates/components/important-date-form-modal';
import { ViewTabs } from '@/features/important-dates/components/view-tabs';
import type {
  AgendaItem,
  ImportantDateView,
  UpcomingView,
} from '@/features/important-dates/types';

const UPCOMING_LIMIT = 10;

export default function ImportantDatesPage() {
  const [view, setView] = useState<UpcomingView | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantDateView | null>(null);

  async function reload() {
    try {
      const data = await listUpcoming(UPCOMING_LIMIT);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Ngày quan trọng"
        subtitle={`${UPCOMING_LIMIT} sự kiện sắp tới`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/important-dates/year"
              className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            >
              Xem cả năm
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
        <div className="mx-auto max-w-2xl space-y-4">
          <ViewTabs current="upcoming" />
          {view === null && (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </>
          )}

          {view !== null && view.items.length === 0 && (
            <Card>
              <EmptyState
                icon="📅"
                title="Chưa có sự kiện sắp tới"
                description="AI sẽ tự sinh danh sách ngày quan trọng cho cả năm. Bạn cũng có thể tự thêm sinh nhật, giỗ chạp, kỷ niệm."
              />
            </Card>
          )}

          {view !== null &&
            view.items.length > 0 &&
            view.items.map((item) => (
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
      </main>

      <ImportantDateFormModal
        open={modalOpen}
        entry={editing}
        onClose={() => setModalOpen(false)}
        onSaved={(saved) => {
          void reload();
          if (view && view.items.length > 0) {
            const lastDay = view.items[view.items.length - 1].daysUntil;
            if (saved.daysUntilNext > lastDay) {
              alert(
                `Đã lưu — "${saved.name}" còn ${saved.daysUntilNext} ngày, không hiện trong top ${UPCOMING_LIMIT}. Xem ở "Cả năm".`,
              );
            }
          }
        }}
      />
    </div>
  );
}
