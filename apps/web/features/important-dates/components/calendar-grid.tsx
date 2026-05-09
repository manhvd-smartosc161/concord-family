'use client';

import type { AgendaItem } from '../types';
import { lunarOf } from '../lib/lunar';

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDate: string;
  itemsByDate: Map<string, AgendaItem[]>;
  onSelect: (iso: string) => void;
}

const DOW_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const DOT_TONE: Record<string, string> = {
  birthday: 'bg-emerald-500',
  death_anniversary: 'bg-rose-500',
  anniversary: 'bg-amber-500',
  other: 'bg-stone-400',
  lunar: 'bg-sky-500',
  national: 'bg-rose-500',
  international: 'bg-violet-500',
  religious: 'bg-amber-500',
};

export function CalendarGrid({
  year,
  month,
  selectedDate,
  itemsByDate,
  onSelect,
}: CalendarGridProps) {
  const cells = buildMonthCells(year, month);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60">
      <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/50">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-stone-500"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const isCurrentMonth = cell.month === month;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;
          const items = itemsByDate.get(cell.iso) ?? [];
          const lunar = lunarOf(cell.date);
          const isLunarSpecial = lunar.isFirstDay || lunar.isFullMoon;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={`relative flex min-h-[58px] flex-col items-stretch border-b border-r border-stone-100 px-1 py-1 text-left transition-colors last:border-r-0 sm:min-h-[72px] ${
                isSelected
                  ? 'bg-emerald-50'
                  : isToday
                    ? 'bg-amber-50/40'
                    : 'hover:bg-stone-50'
              } ${isCurrentMonth ? '' : 'text-stone-300'}`}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums sm:h-7 sm:w-7 sm:text-sm ${
                    isToday && isCurrentMonth
                      ? 'bg-emerald-600 font-semibold text-white'
                      : isCurrentMonth
                        ? 'font-medium text-stone-800'
                        : ''
                  }`}
                >
                  {cell.day}
                </span>
              </div>
              <div
                className={`mt-0.5 text-[9px] tabular-nums sm:text-[10px] ${
                  isLunarSpecial && isCurrentMonth
                    ? 'font-semibold text-rose-600'
                    : 'text-stone-400'
                }`}
              >
                {lunar.day}/{lunar.month}
              </div>
              {items.length > 0 && (
                <div className="mt-auto flex items-center gap-0.5 pt-1">
                  {items.slice(0, 3).map((it, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 w-1.5 rounded-full ${
                        DOT_TONE[it.kind] ?? 'bg-stone-400'
                      }`}
                    />
                  ))}
                  {items.length > 3 && (
                    <span className="text-[9px] text-stone-500">
                      +{items.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Cell {
  iso: string;
  date: Date;
  day: number;
  month: number;
  year: number;
}

function buildMonthCells(year: number, month: number): Cell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startDow = firstOfMonth.getDay();
  const start = new Date(year, month - 1, 1 - startDow);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      iso: toIso(d),
      date: d,
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }
  return cells;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
