'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatVND } from '@/lib/format';
import { listUpcoming } from '@/features/important-dates/api';
import type { AgendaItem } from '@/features/important-dates/types';
import { getMonthlyReport } from '@/features/reports/api';
import type { MonthlyReport, CategoryAggregate } from '@/features/reports/types';
import { listGoals } from '@/features/goals/api';
import type { GoalView } from '@/features/goals/types';
import { getDebtsSummary } from '@/features/debts/api';
import type { DebtSummary } from '@/features/debts/types';
import { listTasks } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/types';
import { useAuthedLayout } from '../layout';
import type { FundView } from '@/features/funds/types';
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
  formatFinancialMonthRange,
} from '@/lib/financial-month';
import { pickFundIcon } from '@/features/funds/components/fund-card';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
  StatCard,
} from '@/components/ui';

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tReports = useTranslations('reports');
  const locale = useLocale();
  const { user, funds, family } = useAuthedLayout();
  const cutoffDay = family?.financialMonthCutoffDay ?? 1;

  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<AgendaItem[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [reportFundId, setReportFundId] = useState<string>('');
  const now0 = new Date();
  const initialFM = getCurrentFinancialMonth(now0, 1);
  const [year, setYear] = useState(initialFM.year);
  const [month, setMonth] = useState(initialFM.month);
  const [reportLoading, setReportLoading] = useState(false);
  const [yearGoal, setYearGoal] = useState<GoalView | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  const [debtLoading, setDebtLoading] = useState(false);
  const reportInitialized = useRef(false);

  const jointFundId = funds.find((f) => f.type === 'joint' && f.purpose === 'spending')?.id;

  useEffect(() => {
    if (!family) return;
    const fm = getCurrentFinancialMonth(new Date(), family.financialMonthCutoffDay);
    setYear(fm.year);
    setMonth(fm.month);
  }, [family?.id]);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      listUpcoming(3),
      getMonthlyReport(year, month, 'joint'),
      listGoals(),
      listTasks(getISOWeek(now)),
      getDebtsSummary(jointFundId),
    ])
      .then(([upcomingView, rep, goals, taskList, debtSum]) => {
        setUpcoming(upcomingView.items.slice(0, 3));
        setReport(rep);
        setYearGoal(goals.find((g) => g.period === 'year' && g.type === 'save') ?? null);
        setTasks(taskList);
        setDebtSummary(debtSum);
      })
      .finally(() => setLoading(false));
  }, [jointFundId]);

  useEffect(() => {
    if (!reportInitialized.current) {
      reportInitialized.current = true;
      return;
    }
    setReportLoading(true);
    setDebtLoading(true);
    Promise.all([
      getMonthlyReport(
        year,
        month,
        reportFundId ? 'all' : 'joint',
        reportFundId || undefined,
      ),
      getDebtsSummary(reportFundId || jointFundId),
    ])
      .then(([rep, debtSum]) => {
        setReport(rep);
        setDebtSummary(debtSum);
      })
      .finally(() => {
        setReportLoading(false);
        setDebtLoading(false);
      });
  }, [reportFundId, year, month]);

  function shiftMonth(delta: number) {
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

  const now = new Date();
  const spendingFunds = funds.filter((f) => f.purpose === 'spending');
  const incompleteTasks = tasks.filter((task) => task.status !== 'done');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title', { name: user.name })}
        subtitle={now.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      />
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <UpcomingWidget items={upcoming} loading={loading} locale={locale} t={t} />
            <FundsWidget funds={spendingFunds} loading={loading} t={t} />
          </div>
          <MonthStatsWidget
            report={report}
            loading={loading || reportLoading}
            funds={spendingFunds}
            selectedFundId={reportFundId}
            onFundChange={setReportFundId}
            year={year}
            month={month}
            onShift={shiftMonth}
            cutoffDay={cutoffDay}
            t={t}
            tReports={tReports}
          />
          <CategoryBreakdownWidget
            report={report}
            loading={loading || reportLoading}
            tReports={tReports}
          />
          <DebtSummaryWidget summary={debtSummary} loading={loading || debtLoading} t={t} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <YearGoalWidget goal={yearGoal} loading={loading} t={t} />
            <TasksWidget incomplete={incompleteTasks} total={tasks.length} loading={loading} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  lunar: '🌙',
  national: '🇻🇳',
  international: '🌍',
  religious: '⛪',
  other: '📅',
};

type TFn = ReturnType<typeof useTranslations>;

function UpcomingWidget({
  items,
  loading,
  locale,
  t,
}: {
  items: AgendaItem[];
  loading: boolean;
  locale: string;
  t: TFn;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">📅 {t('upcoming_title')}</h3>
        <Link href="/important-dates" className="text-xs text-emerald-700 hover:text-emerald-900">
          {t('upcoming_view_all')}
        </Link>
      </div>
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      )}
      {!loading && items.length === 0 && (
        <EmptyState icon="🗓️" title={t('upcoming_empty')} description="" />
      )}
      {!loading && items.map((item) => (
        <div key={`${item.occursOn}-${item.kind}-${item.name}`} className="flex items-center justify-between border-b border-border py-2 last:border-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{KIND_LABELS[item.kind] ?? '📅'}</span>
            <div className="leading-tight">
              <div className="text-sm text-foreground">{item.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(item.occursOn).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
                  day: 'numeric',
                  month: 'long',
                })}
                {item.isLunar && t('upcoming_lunar')}
              </div>
            </div>
          </div>
          <span className={`shrink-0 text-xs font-semibold tabular-nums ${item.daysUntil === 0 ? 'text-rose-600' : item.daysUntil <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {item.daysUntil === 0 ? t('upcoming_today') : t('upcoming_days', { days: item.daysUntil })}
          </span>
        </div>
      ))}
    </Card>
  );
}

function FundsWidget({ funds, loading, t }: { funds: FundView[]; loading: boolean; t: TFn }) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">💰 {t('funds_title')}</h3>
        <Link href="/transactions" className="text-xs text-emerald-700 hover:text-emerald-900">
          {t('funds_transactions')}
        </Link>
      </div>
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      )}
      {!loading && funds.length === 0 && (
        <EmptyState icon="💳" title={t('funds_empty')} description="" />
      )}
      {!loading && funds.map((f) => {
        const isPrivate = f.accessLevel === 'private';
        const tone = {
          owner: 'border-emerald-100 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/40',
          joint: 'border-amber-100 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/40',
          private: 'border-border bg-muted',
        }[f.accessLevel];
        return (
          <div key={f.id} className={`flex items-center justify-between rounded-lg border ${tone} px-3 py-2.5 mb-2 last:mb-0`}>
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span>{pickFundIcon(f)}</span> {f.name}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {isPrivate
                ? <span className="text-muted-foreground">— — — đ</span>
                : <span className="text-foreground">{formatVND(f.balance ?? 0)}</span>}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

function MonthStatsWidget({
  report,
  loading,
  funds,
  selectedFundId,
  onFundChange,
  year,
  month,
  onShift,
  cutoffDay,
  t,
  tReports,
}: {
  report: MonthlyReport | null;
  loading: boolean;
  funds: FundView[];
  selectedFundId: string;
  onFundChange: (id: string) => void;
  year: number;
  month: number;
  onShift: (delta: number) => void;
  cutoffDay: number;
  t: TFn;
  tReports: TFn;
}) {
  const currentFM = getCurrentFinancialMonth(new Date(), cutoffDay);
  const isCurrentMonth = year === currentFM.year && month === currentFM.month;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">📊 {t('month_title')}</h3>
        <MonthSwitcher
          year={year}
          month={month}
          onShift={onShift}
          isCurrent={isCurrentMonth}
          cutoffDay={cutoffDay}
          tReports={tReports}
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onFundChange('')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !selectedFundId
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          💛 Quỹ Chung
        </button>
        {funds.filter((f) => f.type === 'personal').map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFundChange(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedFundId === f.id
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            💰 {f.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={tReports('income')}
          value={loading ? '—' : report ? formatVND(report.income) : '—'}
          tone="positive"
          hint={!loading && report ? tReports('txn_count', { count: report.txnCount }) : undefined}
        />
        <StatCard
          label={tReports('expense')}
          value={loading ? '—' : report ? `−${formatVND(report.expense)}` : '—'}
          tone="negative"
          hint={!loading && report ? tReports('categories_count', { count: report.byCategory.length }) : undefined}
        />
        <StatCard
          label={tReports('net')}
          value={loading ? '—' : report ? formatVND(report.net, true) : '—'}
          tone={!report ? 'default' : report.net >= 0 ? 'positive' : 'negative'}
          hint={tReports('net_hint')}
        />
      </div>
    </div>
  );
}

function YearGoalWidget({
  goal,
  loading,
  t,
}: {
  goal: GoalView | null;
  loading: boolean;
  t: TFn;
}) {
  if (loading) return <Card><Skeleton className="h-32 w-full rounded-lg" /></Card>;
  if (!goal) return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">🎯 {t('goal_title')}</h3>
        <Link href="/goals" className="text-xs text-emerald-700 hover:text-emerald-900">{t('goal_manage')}</Link>
      </div>
      <EmptyState icon="🎯" title={t('goal_empty')} description={t('goal_empty_desc')} />
    </Card>
  );

  const pctRaw = (goal.currentProgress / Math.max(goal.targetAmount, 1)) * 100;
  const pct = Math.max(0, Math.min(100, pctRaw));
  const colorMap = { ahead: 'emerald', on_track: 'amber', behind: 'rose' } as const;
  const tone = colorMap[goal.paceStatus];
  const paceLabel = t(`pace_${goal.paceStatus}` as 'pace_ahead' | 'pace_on_track' | 'pace_behind');

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">🎯 {t('goal_title')}</h3>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{paceLabel}</Badge>
          <Link href="/goals" className="text-xs text-emerald-700 hover:text-emerald-900">{t('goal_detail')}</Link>
        </div>
      </div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
          {formatVND(goal.currentProgress)}
        </span>
        <span className="text-sm text-muted-foreground">
          / {formatVND(goal.targetAmount)}{' '}
          <span className="text-xs text-muted-foreground">({pctRaw.toFixed(1)}%)</span>
        </span>
      </div>
      <ProgressBar value={pct} max={100} tone={tone} />
      <div className="mt-2 text-[11px] text-muted-foreground">{t('goal_days_remaining', { days: goal.daysRemaining })}</div>
    </Card>
  );
}

function DebtSummaryWidget({
  summary,
  loading,
  t,
}: {
  summary: DebtSummary | null;
  loading: boolean;
  t: TFn;
}) {
  const hasDebts = summary && (summary.openLentCount > 0 || summary.openBorrowedCount > 0);
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">🤝 {t('debts_title')}</h3>
        <Link href="/debts" className="text-xs text-emerald-700 hover:text-emerald-900">
          {t('debts_view_all')}
        </Link>
      </div>
      {loading && (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}
      {!loading && !hasDebts && (
        <EmptyState icon="🤝" title={t('debts_empty')} description="" />
      )}
      {!loading && hasDebts && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="text-xs text-muted-foreground">{t('debts_lent')}</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-700">
              {formatVND(summary.totalLent)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {t('debts_open_lent', { count: summary.openLentCount })}
            </div>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50/40 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
            <div className="text-xs text-muted-foreground">{t('debts_borrowed')}</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-rose-700">
              {formatVND(summary.totalBorrowed)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {t('debts_open_borrowed', { count: summary.openBorrowedCount })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function TasksWidget({
  incomplete,
  total,
  loading,
  t,
}: {
  incomplete: Task[];
  total: number;
  loading: boolean;
  t: TFn;
}) {
  const done = total - incomplete.length;
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">✅ {t('tasks_title')}</h3>
        <Link href="/weekly" className="text-xs text-emerald-700 hover:text-emerald-900">
          {t('tasks_view_all')}
        </Link>
      </div>
      {loading && <Skeleton className="h-16 w-full rounded-lg" />}
      {!loading && total === 0 && (
        <EmptyState icon="✅" title={t('tasks_empty')} description="" />
      )}
      {!loading && total > 0 && (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{incomplete.length}</span>
            <span className="text-sm text-muted-foreground">{t('tasks_incomplete', { total })}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">{t('tasks_done', { done, total })}</div>
          {incomplete.slice(0, 3).map((task) => (
            <div key={task.id} className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              {task.title}
            </div>
          ))}
          {incomplete.length > 3 && (
            <div className="mt-1 text-[11px] text-muted-foreground">{t('tasks_more', { count: incomplete.length - 3 })}</div>
          )}
        </>
      )}
    </Card>
  );
}

function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
  cutoffDay,
  tReports,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
  cutoffDay: number;
  tReports: TFn;
}) {
  const locale = useLocale();
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'vi-VN',
    { month: 'long', year: 'numeric' },
  );
  let subtitle: string | null = null;
  if (cutoffDay > 1) {
    const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
    subtitle = formatFinancialMonthRange(start, end, locale === 'en' ? 'en' : 'vi');
  }
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label={tReports('previous_month')}
      >
        <ChevronIcon dir="left" />
      </button>
      <div className="min-w-[140px] px-3 py-1 text-center text-sm font-medium text-foreground">
        <div>{monthLabel}</div>
        {subtitle && (
          <div className="text-[10px] font-normal text-muted-foreground">{subtitle}</div>
        )}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={tReports('next_month')}
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

function CategoryBreakdownWidget({
  report,
  loading,
  tReports,
}: {
  report: MonthlyReport | null;
  loading: boolean;
  tReports: TFn;
}) {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        📊 {tReports('expense_by_category')}
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
          title={tReports('no_data')}
          description={tReports('no_data_desc')}
        />
      )}
      {!loading && report && report.byCategory.length > 0 && (
        <CategoryList items={report.byCategory} total={report.expense} />
      )}
    </Card>
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
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span>{c.icon ?? '·'}</span> {c.categoryName}
                <span className="text-[11px] text-muted-foreground">
                  ({c.count} giao dịch)
                </span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  −{formatVND(c.amount)}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {pct.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
