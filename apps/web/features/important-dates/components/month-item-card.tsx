'use client';

import { Card, Badge } from '@/components/ui';
import type { MonthItem, MonthItemKind } from '../types';

const ICONS: Record<MonthItemKind, string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  other: '📌',
  lunar_mung1: '🌑',
  lunar_ram: '🌕',
};

const TYPE_LABEL: Record<MonthItemKind, string> = {
  birthday: 'Sinh nhật',
  death_anniversary: 'Giỗ',
  anniversary: 'Kỷ niệm',
  other: 'Khác',
  lunar_mung1: 'Mùng 1',
  lunar_ram: 'Rằm',
};

const REMIND_LABEL: Record<number, string> = {
  0: 'Hôm đó',
  1: '1 ngày',
  2: '2 ngày',
  3: '3 ngày',
  7: '1 tuần',
  14: '2 tuần',
  30: '1 tháng',
};

export function MonthItemCard({
  item,
  onEdit,
  onDelete,
  onTest,
}: {
  item: MonthItem;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const isLunarSynthetic = item.sourceId === null;
  const date = new Date(item.occursOn);
  const formatted = date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const days = item.daysUntil;
  const dayHint =
    days < 0
      ? `${Math.abs(days)} ngày trước`
      : days === 0
        ? 'Hôm nay'
        : days === 1
          ? 'Ngày mai'
          : `Còn ${days} ngày`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg leading-none">{ICONS[item.kind]}</span>
            <h3 className="text-base font-semibold text-stone-900">
              {item.name}
            </h3>
            <Badge tone={isLunarSynthetic ? 'sky' : 'neutral'}>
              {TYPE_LABEL[item.kind]}
            </Badge>
            {item.isLunar && !isLunarSynthetic && <Badge tone="amber">Âm lịch</Badge>}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            <span className="font-medium text-stone-700">{formatted}</span> ·{' '}
            <span className={days <= 2 ? 'font-semibold text-emerald-700' : ''}>
              {dayHint}
            </span>
          </p>
          {item.remindDaysBefore.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.remindDaysBefore.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
                >
                  {REMIND_LABEL[d] ?? `${d} ngày`}
                </span>
              ))}
            </div>
          )}
          {item.notes && (
            <p className="mt-2 text-xs italic text-stone-500">{item.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onTest}
            className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            title="Bắn thử thông báo ngay"
          >
            🔔 Bắn thử
          </button>
          {!isLunarSynthetic && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
              >
                Xoá
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
