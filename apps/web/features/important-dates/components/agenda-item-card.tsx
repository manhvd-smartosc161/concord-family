"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { lunarOf } from "../lib/lunar";
import type { AgendaItem, AgendaItemKind } from "../types";

const ICONS: Record<AgendaItemKind, string> = {
  birthday: "🎂",
  death_anniversary: "🕯️",
  anniversary: "💍",
  other: "📌",
  lunar: "🌙",
  national: "🇻🇳",
  international: "🌍",
  religious: "🙏",
};

const TYPE_LABEL: Record<AgendaItemKind, string> = {
  birthday: "Sinh nhật",
  death_anniversary: "Giỗ",
  anniversary: "Kỷ niệm",
  other: "Khác",
  lunar: "Âm lịch",
  national: "Lễ Việt Nam",
  international: "Lễ quốc tế",
  religious: "Tôn giáo",
};

const REMIND_LABEL: Record<number, string> = {
  0: "Đúng ngày",
  1: "Trước 1 ngày",
  2: "Trước 2 ngày",
  3: "Trước 3 ngày",
  7: "Trước 1 tuần",
  14: "Trước 2 tuần",
  30: "Trước 1 tháng",
};

const WEEKDAY_VI = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

interface KindStyle {
  rail: string;
  stamp: string;
  stampText: string;
  badgeTone: "emerald" | "amber" | "rose" | "sky" | "neutral";
}

const KIND_STYLE: Record<AgendaItemKind, KindStyle> = {
  birthday: {
    rail: "bg-amber-400",
    stamp: "bg-amber-50 border-amber-200",
    stampText: "text-amber-800",
    badgeTone: "amber",
  },
  death_anniversary: {
    rail: "bg-stone-500",
    stamp: "bg-stone-100 border-stone-300",
    stampText: "text-stone-700",
    badgeTone: "neutral",
  },
  anniversary: {
    rail: "bg-rose-400",
    stamp: "bg-rose-50 border-rose-200",
    stampText: "text-rose-800",
    badgeTone: "rose",
  },
  other: {
    rail: "bg-stone-400",
    stamp: "bg-stone-50 border-stone-200",
    stampText: "text-stone-700",
    badgeTone: "neutral",
  },
  lunar: {
    rail: "bg-sky-400",
    stamp: "bg-sky-50 border-sky-200",
    stampText: "text-sky-800",
    badgeTone: "sky",
  },
  national: {
    rail: "bg-emerald-500",
    stamp: "bg-emerald-50 border-emerald-200",
    stampText: "text-emerald-800",
    badgeTone: "emerald",
  },
  international: {
    rail: "bg-amber-500",
    stamp: "bg-amber-50 border-amber-200",
    stampText: "text-amber-800",
    badgeTone: "amber",
  },
  religious: {
    rail: "bg-violet-400",
    stamp: "bg-violet-50 border-violet-200",
    stampText: "text-violet-800",
    badgeTone: "neutral",
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
  const t = useTranslations('dates');
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleTest() {
    if (sending) return;
    setSending(true);
    try {
      await onTest();
    } finally {
      setSending(false);
    }
  }

  const isUser = item.source === "user";
  const date = new Date(`${item.occursOn}T00:00:00Z`);
  const day = date.getUTCDate();
  const monthShort = String(date.getUTCMonth() + 1).padStart(2, "0");
  const weekday = WEEKDAY_VI[date.getUTCDay()];
  const days = item.daysUntil;
  const imminent = days >= 0 && days <= 2;

  let lunarHint: string | null = null;
  if (item.isLunar) {
    const [y, m, d] = item.occursOn.split("-").map(Number);
    const info = lunarOf(new Date(y, m - 1, d));
    const label =
      info.day === 1
        ? `Mùng 1 tháng ${info.month} âm`
        : info.day === 15
        ? `Rằm tháng ${info.month} âm`
        : `Ngày ${info.day}/${info.month} âm`;
    if (label !== item.name && label !== item.notes) {
      lunarHint = label;
    }
  }

  const dayHint =
    days === 0
      ? t('today')
      : days === 1
      ? t('tomorrow')
      : days < 0
      ? t('days_ago', { days: Math.abs(days) })
      : t('days_until', { days });

  const style = KIND_STYLE[item.kind] ?? KIND_STYLE.other;
  const stampBg = imminent ? "bg-emerald-100 border-emerald-300" : style.stamp;
  const stampText = imminent ? "text-emerald-900" : style.stampText;
  const railBg = imminent ? "bg-emerald-500" : style.rail;

  return (
    <div className="group/card relative rounded-xl bg-white shadow-sm ring-1 ring-stone-200/70 transition-all hover:shadow-md hover:ring-stone-300">
      <div className="relative overflow-hidden rounded-xl">
        <div
          className={`absolute inset-y-0 left-0 w-1 ${railBg} transition-all group-hover/card:w-1.5`}
        />
        <div className="flex h-full items-stretch pl-1">
          <div
            className={`flex w-[64px] shrink-0 flex-col items-center justify-center border-r sm:w-[88px] ${stampBg} ${stampText}`}
          >
            <div className="font-mono text-[22px] font-semibold leading-none tabular-nums sm:text-[28px]">
              {String(day).padStart(2, "0")}
            </div>
            <div className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.16em] opacity-75 sm:mt-1.5 sm:text-[10px] sm:tracking-[0.18em]">
              {weekday}
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.18em] opacity-60 sm:text-[9px] sm:tracking-[0.22em]">
              th {monthShort}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
            <div className="flex min-w-0 items-start gap-2 pr-8">
              <span className="mt-0.5 shrink-0 text-base leading-none">
                {ICONS[item.kind] ?? "📌"}
              </span>
              <h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug text-stone-900">
                {item.name}
              </h3>
              {!isUser && (
                <span className="mt-1 shrink-0 rounded-full bg-stone-900 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                  AI
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={style.badgeTone}>
                {TYPE_LABEL[item.kind] ?? item.kind}
              </Badge>
              {isUser && item.isLunar && <Badge tone="sky">Âm lịch</Badge>}
              <span
                className={
                  imminent
                    ? "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-300"
                    : "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200"
                }
              >
                {imminent && (
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                )}
                {dayHint}
              </span>
            </div>

            {item.remindDaysBefore.length > 0 && (
              <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
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

            {(item.notes || lunarHint) && (
              <div className="flex flex-col gap-0.5 border-l-2 border-stone-200 pl-3">
                {item.notes && (
                  <p className="text-xs italic text-stone-500">{item.notes}</p>
                )}
                {lunarHint && !item.notes && (
                  <p className="text-xs italic text-stone-500">{lunarHint}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-2">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Mở menu"
          className={`flex h-7 w-7 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 ${
            menuOpen ? "bg-stone-100 text-stone-700" : ""
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
              {isUser && (
                <>
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    icon="✏️"
                    label={t('edit')}
                  />
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    icon="🗑️"
                    label={t('delete')}
                    danger
                  />
                  <div className="border-t border-stone-100" />
                </>
              )}
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  void handleTest();
                }}
                icon="🔔"
                label={sending ? "Đang gửi…" : "Thông báo"}
                disabled={sending}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  danger,
  disabled,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
        danger
          ? "text-rose-700 hover:bg-rose-50"
          : "text-stone-700 hover:bg-stone-50"
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

