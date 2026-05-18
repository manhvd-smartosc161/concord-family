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



interface KindStyle {
  rail: string;
  stamp: string;
  stampText: string;
  badgeTone: "emerald" | "amber" | "rose" | "sky" | "neutral";
}

const KIND_STYLE: Record<AgendaItemKind, KindStyle> = {
  birthday: {
    rail: "bg-fuchsia-500",
    stamp: "bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-200 dark:border-fuchsia-900",
    stampText: "text-fuchsia-900 dark:text-fuchsia-300",
    badgeTone: "rose",
  },
  death_anniversary: {
    rail: "bg-muted-foreground",
    stamp: "bg-muted border-border",
    stampText: "text-foreground",
    badgeTone: "neutral",
  },
  anniversary: {
    rail: "bg-pink-500",
    stamp: "bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900",
    stampText: "text-pink-900 dark:text-pink-300",
    badgeTone: "rose",
  },
  other: {
    rail: "bg-muted-foreground/60",
    stamp: "bg-muted border-border",
    stampText: "text-foreground",
    badgeTone: "neutral",
  },
  lunar: {
    rail: "bg-indigo-400",
    stamp: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
    stampText: "text-indigo-800 dark:text-indigo-300",
    badgeTone: "sky",
  },
  national: {
    rail: "bg-red-500",
    stamp: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
    stampText: "text-red-800 dark:text-red-300",
    badgeTone: "rose",
  },
  international: {
    rail: "bg-cyan-500",
    stamp: "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900",
    stampText: "text-cyan-800 dark:text-cyan-300",
    badgeTone: "sky",
  },
  religious: {
    rail: "bg-violet-400",
    stamp: "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900",
    stampText: "text-violet-800 dark:text-violet-300",
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

  const TYPE_LABEL: Record<AgendaItemKind, string> = {
    birthday: t('kind_birthday'),
    death_anniversary: t('kind_death_anniversary'),
    anniversary: t('kind_anniversary'),
    other: t('kind_other'),
    lunar: t('kind_lunar'),
    national: t('kind_national'),
    international: t('kind_international'),
    religious: t('kind_religious'),
  };

  const REMIND_LABEL: Record<number, string> = {
    0: t('remind_on_day'),
    1: t('remind_1_day_before'),
    3: t('remind_3_days_before'),
    7: t('remind_1_week_before'),
  };

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
  const weekday = t(`weekday_${date.getUTCDay()}` as 'weekday_0');
  const days = item.daysUntil;
  const imminent = days >= 0 && days <= 2;

  let lunarHint: string | null = null;
  if (item.isLunar) {
    const [y, m, d] = item.occursOn.split("-").map(Number);
    const info = lunarOf(new Date(y, m - 1, d));
    const label =
      info.day === 1
        ? t('lunar_new_moon_hint', { month: info.month })
        : info.day === 15
        ? t('lunar_full_moon_hint', { month: info.month })
        : t('lunar_day_hint', { day: info.day, month: info.month });
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
  const stampBg = imminent ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-900" : style.stamp;
  const stampText = imminent ? "text-emerald-900" : style.stampText;
  const railBg = imminent ? "bg-emerald-500" : style.rail;

  return (
    <div className="group/card relative rounded-xl bg-card shadow-sm ring-1 ring-border/70 transition-all hover:shadow-md hover:ring-border">
      <div className="relative overflow-hidden rounded-xl">
        <div
          className={`absolute inset-y-0 left-0 w-1 ${railBg} transition-all group-hover/card:w-1.5`}
        />
        <div className="flex h-full items-stretch pl-1">
          <div
            className={`flex w-[72px] shrink-0 flex-col items-center justify-center border-r py-4 sm:w-[88px] ${stampBg} ${stampText}`}
          >
            <div className="font-mono text-[30px] font-bold leading-none tabular-nums sm:text-[36px]">
              {String(day).padStart(2, "0")}
            </div>
            <div className="mt-1.5 text-[10px] font-semibold leading-snug opacity-80 sm:text-[11px]">
              {weekday}
            </div>
            <div className="text-[9px] leading-snug opacity-50 sm:text-[10px]">
              {t(`month_${Number(monthShort)}` as 'month_1')}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
            <div className="flex min-w-0 items-start gap-2 pr-8">
              <span className="mt-0.5 shrink-0 text-base leading-none">
                {ICONS[item.kind] ?? "📌"}
              </span>
              <h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug text-foreground">
                {item.name}
              </h3>
              {!isUser && (
                <span className="mt-1 shrink-0 rounded-full bg-foreground px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-background">
                  AI
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={style.badgeTone}>
                {TYPE_LABEL[item.kind] ?? item.kind}
              </Badge>
              {isUser && item.isLunar && <Badge tone="sky">{t('lunar_calendar')}</Badge>}
              <span
                className={
                  imminent
                    ? "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-900"
                    : "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border"
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
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Nhắc
                </span>
                {item.remindDaysBefore.map((d) => (
                  <span
                    key={d}
                    className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/70"
                  >
                    {REMIND_LABEL[d] ?? t('remind_days_before', { days: d })}
                  </span>
                ))}
              </div>
            )}

            {(item.notes || lunarHint) && (
              <div className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
                {item.notes && (
                  <p className="text-xs italic text-muted-foreground">{item.notes}</p>
                )}
                {lunarHint && !item.notes && (
                  <p className="text-xs italic text-muted-foreground">{lunarHint}</p>
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
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Mở menu"
          className={`flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            menuOpen ? "bg-muted text-foreground" : ""
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
              onPointerDown={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
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
                  <div className="border-t border-border" />
                </>
              )}
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  void handleTest();
                }}
                icon="🔔"
                label={sending ? t('sending') : t('notify')}
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
          ? "text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/60"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

