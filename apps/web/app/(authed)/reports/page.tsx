'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatVND } from '@/lib/format';
import { getMonthlyReport } from '@/features/reports/api';
import type {
  CategoryAggregate,
  MonthlyReport,
} from '@/features/reports/types';
import {
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/components/ui';

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMonthlyReport(year, month, 'joint')
      .then(setReport)
      .finally(() => setLoading(false));
  }, [year, month]);

  function shift(delta: number) {
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
    setYear(y);
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Báo cáo tháng"
        subtitle="Tổng quan thu chi + breakdown theo mục"
        actions={
          <MonthSwitcher
            year={year}
            month={month}
            onShift={shift}
            isCurrent={isCurrentMonth}
          />
        }
      />

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Thu nhập"
              value={report ? formatVND(report.income) : '—'}
              tone="positive"
            />
            <StatCard
              label="Chi tiêu"
              value={report ? `−${formatVND(report.expense)}` : '—'}
              tone="negative"
            />
            <StatCard
              label="Net"
              value={report ? formatVND(report.net, true) : '—'}
              tone={
                !report ? 'default' : report.net >= 0 ? 'positive' : 'negative'
              }
            />
            <StatCard
              label="Số giao dịch"
              value={report ? `${report.txnCount}` : '—'}
              tone="neutral"
            />
          </div>

          {/* Chart */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-stone-800">
              Thu chi theo ngày
            </h3>
            {loading && <Skeleton className="h-72 w-full" />}
            {!loading && report && (
              <DailyChart report={report} />
            )}
          </Card>

          {/* Category breakdown */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-stone-800">
              Chi tiêu theo mục
            </h3>
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!loading && report && report.byCategory.length === 0 && (
              <EmptyState
                icon="📭"
                title="Chưa có chi tiêu nào trong tháng này"
                description="Vào tab Chat để bắt đầu log giao dịch."
              />
            )}
            {!loading && report && report.byCategory.length > 0 && (
              <CategoryList items={report.byCategory} total={report.expense} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="rounded-md p-1.5 text-stone-600 transition-colors hover:bg-stone-100"
        aria-label="Tháng trước"
      >
        <ChevronIcon dir="left" />
      </button>
      <div className="min-w-[140px] px-3 py-1 text-center text-sm font-medium text-stone-800">
        Tháng {month}/{year}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="rounded-md p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Tháng sau"
      >
        <ChevronIcon dir="right" />
      </button>
    </div>
  );
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}

function DailyChart({ report }: { report: MonthlyReport }) {
  const data = useMemo(
    () =>
      report.byDay.map((d) => ({
        day: parseInt(d.date.slice(8, 10), 10),
        Thu: d.income,
        Chi: -d.expense, // negative so it shows below axis
      })),
    [report.byDay],
  );

  const barChart = (
    <BarChart data={data} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
      <XAxis
        dataKey="day"
        tick={{ fontSize: 11, fill: '#78716c' }}
        tickLine={false}
        axisLine={{ stroke: '#e7e5e4' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#78716c' }}
        tickLine={false}
        axisLine={{ stroke: '#e7e5e4' }}
        tickFormatter={(v: number) => {
          const a = Math.abs(v);
          if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
          if (a >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
          return `${v}`;
        }}
      />
      <Tooltip
        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        content={<ChartTooltip />}
      />
      <Bar
        dataKey="Thu"
        fill="#10b981"
        radius={[4, 4, 0, 0]}
        maxBarSize={28}
      />
      <Bar
        dataKey="Chi"
        fill="#f43f5e"
        radius={[0, 0, 4, 4]}
        maxBarSize={28}
      />
    </BarChart>
  );

  return (
    <>
      <div className="lg:hidden">
        <ResponsiveContainer width="100%" height={240}>{barChart}</ResponsiveContainer>
      </div>
      <div className="hidden lg:block">
        <ResponsiveContainer width="100%" height={288}>{barChart}</ResponsiveContainer>
      </div>
    </>
  );
}

interface ChartTooltipPayload {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-stone-700">Ngày {label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-stone-600">{p.name}:</span>
          <span className="font-mono font-semibold tabular-nums text-stone-900">
            {formatVND(Math.abs(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryList({
  items,
  total,
}: {
  items: CategoryAggregate[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((c) => {
        const pct = total > 0 ? (c.amount / total) * 100 : 0;
        return (
          <div key={c.categoryId ?? c.categoryName}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-sm text-stone-800">
                <span>{c.icon ?? '·'}</span> {c.categoryName}
                <span className="text-[11px] text-stone-400">
                  ({c.count} giao dịch)
                </span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-stone-900">
                  −{formatVND(c.amount)}
                </span>
                <span className="text-[11px] tabular-nums text-stone-400">
                  {pct.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full bg-rose-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
