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
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
      <div className="grid grid-cols-7 border-b border-stone-100">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className={`py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] ${
              i === 0 ? 'text-rose-400' : 'text-stone-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const isCurrentMonth = cell.month === month;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;
          const isSunday = cell.date.getDay() === 0;
          const items = itemsByDate.get(cell.iso) ?? [];
          const lunar = lunarOf(cell.date);
          const isLunarSpecial = lunar.isFirstDay || lunar.isFullMoon;
          const isFirstRow = idx < 7;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={`group relative flex h-14 flex-col items-center justify-start pt-1.5 transition-colors sm:h-16 ${
                isFirstRow ? '' : 'border-t border-stone-100/70'
              } ${isCurrentMonth ? 'hover:bg-stone-50/60' : ''}`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                  isSelected
                    ? 'bg-stone-900 font-semibold text-white'
                    : isToday
                      ? 'bg-emerald-600 font-semibold text-white shadow-sm shadow-emerald-600/30'
                      : !isCurrentMonth
                        ? 'font-normal text-stone-300'
                        : isSunday
                          ? 'font-medium text-rose-500'
                          : 'font-medium text-stone-800'
                }`}
              >
                {cell.day}
              </span>
              <span
                className={`mt-0.5 text-[9px] tabular-nums leading-none sm:text-[10px] ${
                  !isCurrentMonth
                    ? 'text-stone-200'
                    : isLunarSpecial
                      ? 'font-semibold text-rose-500'
                      : 'text-stone-400'
                }`}
              >
                {lunar.day}/{lunar.month}
              </span>
              {items.length > 0 && (
                <div className="absolute bottom-1 flex items-center justify-center gap-[3px]">
                  {items.slice(0, 3).map((it, i) => (
                    <span
                      key={i}
                      className={`h-1 w-1 rounded-full ${
                        DOT_TONE[it.kind] ?? 'bg-stone-400'
                      }`}
                    />
                  ))}
                  {items.length > 3 && (
                    <span className="text-[8px] font-medium leading-none text-stone-500">
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
