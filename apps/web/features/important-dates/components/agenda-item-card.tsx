'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui';
import type { AgendaItem, AgendaItemKind } from '../types';

const ICONS: Record<AgendaItemKind, string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  other: '📌',
  lunar: '🌙',
  national: '🇻🇳',
  international: '🌍',
  religious: '🙏',
};

const TYPE_LABEL: Record<AgendaItemKind, string> = {
  birthday: 'Sinh nhật',
  death_anniversary: 'Giỗ',
  anniversary: 'Kỷ niệm',
  other: 'Khác',
  lunar: 'Âm lịch',
  national: 'Lễ Việt Nam',
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

const WEEKDAY_VI = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];

interface KindStyle {
  rail: string;
  stamp: string;
  stampText: string;
  badgeTone: 'emerald' | 'amber' | 'rose' | 'sky' | 'neutral';
}

const KIND_STYLE: Record<AgendaItemKind, KindStyle> = {
  birthday: {
    rail: 'bg-amber-400',
    stamp: 'bg-amber-50 border-amber-200',
    stampText: 'text-amber-800',
    badgeTone: 'amber',
  },
  death_anniversary: {
    rail: 'bg-stone-500',
    stamp: 'bg-stone-100 border-stone-300',
    stampText: 'text-stone-700',
    badgeTone: 'neutral',
  },
  anniversary: {
    rail: 'bg-rose-400',
    stamp: 'bg-rose-50 border-rose-200',
    stampText: 'text-rose-800',
    badgeTone: 'rose',
  },
  other: {
    rail: 'bg-stone-400',
    stamp: 'bg-stone-50 border-stone-200',
    stampText: 'text-stone-700',
    badgeTone: 'neutral',
  },
  lunar: {
    rail: 'bg-sky-400',
    stamp: 'bg-sky-50 border-sky-200',
    stampText: 'text-sky-800',
    badgeTone: 'sky',
  },
  national: {
    rail: 'bg-emerald-500',
    stamp: 'bg-emerald-50 border-emerald-200',
    stampText: 'text-emerald-800',
    badgeTone: 'emerald',
  },
  international: {
    rail: 'bg-amber-500',
    stamp: 'bg-amber-50 border-amber-200',
    stampText: 'text-amber-800',
    badgeTone: 'amber',
  },
  religious: {
    rail: 'bg-violet-400',
    stamp: 'bg-violet-50 border-violet-200',
    stampText: 'text-violet-800',
    badgeTone: 'neutral',
  },
};

export function AgendaItemCard({
  item,
  onEdit,
  onDelete,
  onTest,
}: {
  item: AgendaItem;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<void>;
}) {
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

  const isUser = item.source === 'user';
  const date = new Date(`${item.occursOn}T00:00:00Z`);
  const day = date.getUTCDate();
  const monthShort = String(date.getUTCMonth() + 1).padStart(2, '0');
  const weekday = WEEKDAY_VI[date.getUTCDay()];
  const days = item.daysUntil;
  const imminent = days >= 0 && days <= 2;

  const dayHint =
    days === 0
      ? 'Hôm nay'
      : days === 1
        ? 'Ngày mai'
        : days < 0
          ? `${Math.abs(days)} ngày trước`
          : `Còn ${days} ngày`;

  const style = KIND_STYLE[item.kind] ?? KIND_STYLE.other;
  const stampBg = imminent
    ? 'bg-emerald-100 border-emerald-300'
    : style.stamp;
  const stampText = imminent ? 'text-emerald-900' : style.stampText;
  const railBg = imminent ? 'bg-emerald-500' : style.rail;

  return (
    <div className="group/card relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200/70 transition-all hover:shadow-md hover:ring-stone-300">
      <div
        className={`absolute inset-y-0 left-0 w-1 ${railBg} transition-all group-hover/card:w-1.5`}
      />
      <div className="flex h-full items-stretch pl-1">
        <div
          className={`flex w-[88px] shrink-0 flex-col items-center justify-center border-r ${stampBg} ${stampText}`}
        >
          <div className="font-mono text-[28px] font-semibold leading-none tabular-nums">
            {String(day).padStart(2, '0')}
          </div>
          <div className="mt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] opacity-75">
            {weekday}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] opacity-60">
            tháng {monthShort}
          </div>
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col p-3 sm:p-4 sm:pr-3">
          <div className="flex flex-wrap items-center gap-2 pr-32">
            <span className="text-base leading-none">
              {ICONS[item.kind] ?? '📌'}
            </span>
            <h3 className="text-[15px] font-semibold leading-snug text-stone-900">
              {item.name}
            </h3>
            <Badge tone={style.badgeTone}>
              {TYPE_LABEL[item.kind] ?? item.kind}
            </Badge>
            {!isUser && (
              <span className="inline-flex items-center rounded-full bg-stone-900 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                AI
              </span>
            )}
            {isUser && item.isLunar && <Badge tone="sky">Âm lịch</Badge>}
            <span
              className={
                imminent
                  ? 'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-300'
                  : 'inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200'
              }
            >
              {imminent && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              )}
              {dayHint}
            </span>
          </div>

          {item.remindDaysBefore.length > 0 && (
            <div className="mt-3 hidden flex-wrap items-center gap-1.5 sm:flex">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Nhắc
              </span>
              {item.remindDaysBefore.map((d) => (
                <span
                  key={d}
                  className="rounded-md bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600 ring-1 ring-stone-200/70"
                >
                  {REMIND_LABEL[d] ?? `Trước ${d} ngày`}
                </span>
              ))}
            </div>
          )}

          {item.notes && (
            <p className="mt-3 hidden border-l-2 border-stone-200 pl-3 text-xs italic text-stone-500 sm:block">
              {item.notes}
            </p>
          )}

          <div className="absolute right-3 top-3 flex items-center gap-2">
            {isUser && (
              <>
                <IconButton label="Sửa" onClick={onEdit} tone="amber">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 20h4l10-10-4-4L4 16v4z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m13.5 6.5 4 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
                <IconButton label="Xoá" onClick={onDelete} tone="rose">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconButton>
              </>
            )}
            <IconButton
              label={sending ? 'Đang gửi…' : 'Bắn thông báo'}
              onClick={handleTest}
              disabled={sending}
              tone="emerald"
              size="lg"
            >
              {sending ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="animate-spin"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray="40 60"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="transition-transform group-hover/btn:rotate-[12deg]"
                >
                  <path
                    d="M12 3.5c-3.6 0-6.5 2.9-6.5 6.5v3.2c0 .8-.3 1.6-.9 2.1l-1.1 1.1c-.5.5-.2 1.4.5 1.4h16c.7 0 1-.9.5-1.4l-1.1-1.1c-.6-.6-.9-1.3-.9-2.1V10c0-3.6-2.9-6.5-6.5-6.5z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 19.5c.3 1 1.1 1.5 2 1.5s1.7-.5 2-1.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone,
  size = 'sm',
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: 'emerald' | 'amber' | 'rose';
  size?: 'sm' | 'lg';
  children: React.ReactNode;
}) {
  const toneClass = {
    emerald:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 hover:ring-emerald-400 hover:text-emerald-800',
    amber:
      'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100 hover:ring-amber-400 hover:text-amber-800',
    rose:
      'bg-rose-50 text-rose-600 ring-rose-200 hover:bg-rose-100 hover:ring-rose-400 hover:text-rose-700',
  }[tone];
  const sizeClass = size === 'lg' ? 'h-9 w-9' : 'h-7 w-7';
  return (
    <div className="group/btn relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`flex ${sizeClass} cursor-pointer items-center justify-center rounded-full ring-1 transition-all ${toneClass} hover:shadow-sm disabled:cursor-wait disabled:opacity-60`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute right-1/2 top-full z-10 mt-1 translate-x-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/btn:opacity-100">
        {label}
      </span>
    </div>
  );
}
