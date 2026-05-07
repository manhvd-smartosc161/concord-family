'use client';

import { useState } from 'react';
import { Card, Badge } from '@/components/ui';
import type { MonthItem, MonthItemKind } from '../types';

const ICONS: Record<MonthItemKind, string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  other: '📌',
  lunar: '🌙',
  national: '🇻🇳',
  international: '🌍',
  religious: '🙏',
};

const TYPE_LABEL: Record<MonthItemKind, string> = {
  birthday: 'Sinh nhật',
  death_anniversary: 'Giỗ',
  anniversary: 'Kỷ niệm',
  other: 'Khác',
  lunar: 'Âm lịch',
  national: 'Lễ VN',
  international: 'Lễ quốc tế',
  religious: 'Tôn giáo',
};

const REMIND_LABEL: Record<number, string> = {
  0: 'Đúng ngày',
  1: 'Trước 1 ngày',
  2: 'Trước 2 ngày',
  3: 'Trước 3 ngày',
  7: 'Trước 1 tuần',
  14: 'Trước 2 tuần',
  30: 'Trước 1 tháng',
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
  onTest: () => Promise<void>;
}) {
  const isUser = item.source === 'user';
  const [sending, setSending] = useState(false);

  async function handleTest() {
    if (sending) return;
    setSending(true);
    try {
      await onTest();
    } finally {
      setSending(false);
    }
  }
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
            <span className="text-lg leading-none">{ICONS[item.kind] ?? '📌'}</span>
            <h3 className="text-base font-semibold text-stone-900">
              {item.name}
            </h3>
            <Badge tone={isUser ? 'neutral' : 'sky'}>
              {TYPE_LABEL[item.kind] ?? item.kind}
            </Badge>
            {!isUser && <Badge tone="amber">AI</Badge>}
            {isUser && item.isLunar && <Badge tone="amber">Âm lịch</Badge>}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            <span className="font-medium text-stone-700">{formatted}</span> ·{' '}
            <span className={days >= 0 && days <= 2 ? 'font-semibold text-emerald-700' : ''}>
              {dayHint}
            </span>
          </p>
          {item.remindDaysBefore.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-stone-400">Nhắc:</span>
              {item.remindDaysBefore.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
                >
                  {REMIND_LABEL[d] ?? `Trước ${d} ngày`}
                </span>
              ))}
            </div>
          )}
          {item.notes && (
            <p className="mt-2 text-xs italic text-stone-500">{item.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={sending}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
            title="Gửi mail thông báo ngay"
          >
            {sending ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" />
                <span>Đang gửi…</span>
              </>
            ) : (
              <>
                <span className="text-xl leading-none">🔔</span>
                <span>Bắn thông báo</span>
              </>
            )}
          </button>
          {isUser && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="cursor-pointer rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
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
