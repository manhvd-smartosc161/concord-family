'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import {
  deleteImportantDate,
  listForYear,
  notifyAiDate,
  testNotifyImportantDate,
} from '@/features/important-dates/api';
import { AgendaItemCard } from '@/features/important-dates/components/agenda-item-card';
import { CalendarGrid } from '@/features/important-dates/components/calendar-grid';
import { ImportantDateFormModal } from '@/features/important-dates/components/important-date-form-modal';
import { ViewTabs } from '@/features/important-dates/components/view-tabs';
import { lunarOf } from '@/features/important-dates/lib/lunar';
import type {
  AgendaItem,
  ImportantDateView,
  YearAgendaView,
} from '@/features/important-dates/types';

function getMonthLabel(month: number, year: number, locale: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'vi-VN',
    { month: 'long', year: 'numeric' },
  );
}

function getDowLabels(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { weekday: 'short' }),
  );
}

export default function CalendarPage() {
  const t = useTranslations('dates');
  const locale = useLocale();
  const today = new Date();
  const todayIso = isoOf(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [view, setView] = useState<YearAgendaView | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantDateView | null>(null);

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

  const itemsByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    if (!view) return map;
    for (const item of view.items) {
      const existing = map.get(item.occursOn);
      if (existing) existing.push(item);
      else map.set(item.occursOn, [item]);
    }
    return map;
  }, [view]);

  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  const selectedDateObj = parseIso(selectedDate);
  const selectedLunar = lunarOf(selectedDateObj);
  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    if (y !== year) setYear(y);
  }

  function jumpToToday() {
    const t = new Date();
    setMonth(t.getMonth() + 1);
    setYear(t.getFullYear());
    setSelectedDate(isoOf(t));
  }

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

  async function handleDelete(item: AgendaItem) {
    if (!item.sourceId) return;
    if (!confirm(`${t('delete')} "${item.name}"?`)) return;
    try {
      await deleteImportantDate(item.sourceId);
      await reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleTest(item: AgendaItem) {
    try {
      if (item.source === 'ai') {
        await notifyAiDate(item.name, item.occursOn, item.kind, item.notes);
      } else if (item.sourceId) {
        await testNotifyImportantDate(item.sourceId);
      }
      alert(t('email_test_sent'));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={getMonthLabel(month, year, locale)}
        subtitle={t('calendar_subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              className="rounded-lg bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            >
              {t('today')}
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
              aria-label="Next month"
            >
              ›
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              {t('add_date')}
            </button>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/30 via-stone-50 to-stone-50 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <ViewTabs current="calendar" />

          {view === null ? (
            <Skeleton className="h-[420px] w-full rounded-xl" />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              selectedDate={selectedDate}
              itemsByDate={itemsByDate}
              onSelect={setSelectedDate}
            />
          )}

          <Card>
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
              <div className="flex items-baseline gap-3">
                <div className="font-mono text-3xl font-bold leading-none tabular-nums text-stone-900">
                  {selectedDateObj.getDate()}
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-stone-800">
                    {getDowLabels(locale)[selectedDateObj.getDay()]},{' '}
                    {selectedDateObj.getDate()}/
                    {selectedDateObj.getMonth() + 1}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-500">
                    {t('lunar_label')}: {selectedLunar.day}/{selectedLunar.month}
                    {selectedLunar.isFirstDay && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600">
                        {t('lunar_first_day')}
                      </span>
                    )}
                    {selectedLunar.isFullMoon && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                        {t('lunar_full_moon')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {selectedItems.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  {selectedItems.length} {t('events_count')}
                </span>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <EmptyState
                icon="🗓"
                title={t('no_dates')}
                description={t('no_dates_desc')}
              />
            ) : (
              <div className="space-y-2">
                {selectedItems.map((item, idx) => (
                  <AgendaItemCard
                    key={`${item.sourceId ?? 'ai'}-${idx}`}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item)}
                    onTest={() => handleTest(item)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      <ImportantDateFormModal
        open={modalOpen}
        entry={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          void reload();
        }}
      />
    </div>
  );
}

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}
