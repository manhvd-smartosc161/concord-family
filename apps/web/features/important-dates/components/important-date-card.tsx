'use client';

import { Card, Badge } from '@/components/ui';
import type { ImportantDateView, ImportantDateType } from '../types';

const ICONS: Record<ImportantDateType, string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  other: '📌',
};

const TYPE_LABEL: Record<ImportantDateType, string> = {
  birthday: 'Sinh nhật',
  death_anniversary: 'Giỗ',
  anniversary: 'Kỷ niệm',
  other: 'Khác',
};

const REMIND_LABEL: Record<number, string> = {
  0: 'Hôm đó',
  1: '1 ngày',
  3: '3 ngày',
  7: '1 tuần',
  14: '2 tuần',
  30: '1 tháng',
};

export function ImportantDateCard({
  entry,
  onEdit,
  onDelete,
  onTest,
}: {
  entry: ImportantDateView;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const next = new Date(entry.nextOccurrence);
  const formatted = next.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const days = entry.daysUntilNext;
  const dayHint =
    days === 0 ? 'Hôm nay' : days === 1 ? 'Ngày mai' : `Còn ${days} ngày`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{ICONS[entry.type]}</span>
            <h3 className="text-base font-semibold text-stone-900">
              {entry.name}
            </h3>
            <Badge tone="neutral">{TYPE_LABEL[entry.type]}</Badge>
            {entry.isLunar && <Badge tone="amber">Âm lịch</Badge>}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Sắp tới: <span className="font-medium text-stone-700">{formatted}</span>{' '}
            · {dayHint}
          </p>
          {entry.remindDaysBefore.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.remindDaysBefore.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
                >
                  {REMIND_LABEL[d] ?? `${d} ngày`}
                </span>
              ))}
            </div>
          )}
          {entry.notes && (
            <p className="mt-2 text-xs italic text-stone-500">{entry.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onTest}
            className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            title="Bắn thông báo test ngay (mail + FCM)"
          >
            🔔 Bắn thử
          </button>
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
        </div>
      </div>
    </Card>
  );
}
