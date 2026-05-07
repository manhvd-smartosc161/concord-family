'use client';

import { useEffect, useState } from 'react';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import {
  deleteImportantDate,
  listImportantDates,
  testNotifyImportantDate,
} from '@/features/important-dates/api';
import { ImportantDateCard } from '@/features/important-dates/components/important-date-card';
import { ImportantDateFormModal } from '@/features/important-dates/components/important-date-form-modal';
import type { ImportantDateView } from '@/features/important-dates/types';

export default function ImportantDatesPage() {
  const [items, setItems] = useState<ImportantDateView[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantDateView | null>(null);

  async function reload() {
    try {
      const data = await listImportantDates();
      setItems(data);
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

  function openEdit(entry: ImportantDateView) {
    setEditing(entry);
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

  async function handleTest(id: string) {
    try {
      await testNotifyImportantDate(id);
      alert('Đã bắn — kiểm tra mail và notification');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Ngày quan trọng"
        subtitle="Sinh nhật, giỗ chạp, kỷ niệm — nhắc qua mail và thông báo điện thoại"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Thêm ngày
          </button>
        }
      />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {items === null && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {items !== null && items.length === 0 && (
            <Card>
              <EmptyState
                icon="📅"
                title="Chưa có ngày nào"
                description="Thêm sinh nhật, giỗ chạp hoặc kỷ niệm để Concord nhắc bạn đúng lúc."
              />
            </Card>
          )}

          {items !== null && items.length > 0 && (
            <div className="space-y-3">
              {items.map((entry) => (
                <ImportantDateCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => handleDelete(entry.id)}
                  onTest={() => handleTest(entry.id)}
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
        onSaved={() => {
          void reload();
        }}
      />
    </div>
  );
}
