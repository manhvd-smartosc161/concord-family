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
    <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-stone-200/70 sm:p-3">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className={`py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] ${
              i === 0 ? 'text-rose-400' : 'text-stone-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isCurrentMonth = cell.month === month;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;
          const isSunday = cell.date.getDay() === 0;
          const items = itemsByDate.get(cell.iso) ?? [];
          const lunar = lunarOf(cell.date);
          const isLunarSpecial = lunar.isFirstDay || lunar.isFullMoon;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={`group relative flex aspect-square flex-col items-center justify-start rounded-xl px-1 py-1.5 transition-all duration-150 sm:py-2 ${
                isSelected
                  ? 'bg-emerald-600 shadow-md shadow-emerald-600/20'
                  : isToday
                    ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                    : isCurrentMonth
                      ? 'hover:bg-stone-100/70 active:bg-stone-100'
                      : ''
              }`}
            >
              <span
                className={`text-[13px] font-semibold tabular-nums leading-none sm:text-sm ${
                  !isCurrentMonth
                    ? 'text-stone-300'
                    : isSelected
                      ? 'text-white'
                      : isToday
                        ? 'text-emerald-700'
                        : isSunday
                          ? 'text-rose-500'
                          : 'text-stone-800'
                }`}
              >
                {cell.day}
              </span>
              <span
                className={`mt-0.5 text-[9px] tabular-nums leading-none sm:text-[10px] ${
                  !isCurrentMonth
                    ? 'text-stone-200'
                    : isSelected
                      ? 'text-emerald-100'
                      : isLunarSpecial
                        ? 'font-semibold text-rose-500'
                        : 'text-stone-400'
                }`}
              >
                {lunar.day}/{lunar.month}
              </span>
              {items.length > 0 && (
                <div className="mt-auto flex items-center justify-center gap-[3px] pb-0.5 pt-1">
                  {items.slice(0, 3).map((it, idx) => (
                    <span
                      key={idx}
                      className={`h-[5px] w-[5px] rounded-full ${
                        isSelected
                          ? 'bg-white/90'
                          : DOT_TONE[it.kind] ?? 'bg-stone-400'
                      }`}
                    />
                  ))}
                  {items.length > 3 && (
                    <span
                      className={`text-[8px] font-medium leading-none ${
                        isSelected ? 'text-white/90' : 'text-stone-500'
                      }`}
                    >
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
