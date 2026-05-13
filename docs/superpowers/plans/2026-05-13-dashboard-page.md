# Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trang Dashboard mới tại `/dashboard` hiển thị 5 widget: sắp tới (3 ngày quan trọng), số dư quỹ, chi tiết tháng này, tiến độ mục tiêu năm, và tasks chưa hoàn thành.

**Architecture:** Một page component duy nhất fetch song song 5 data sources trong `Promise.all` rồi render 5 widget sub-component. Không có state riêng per-widget — tất cả state sống ở page level. Tận dụng `funds` từ `useAuthedLayout()` context (đã sẵn, không cần fetch thêm).

**Tech Stack:** NextJS App Router, React `useState`/`useEffect`, Tailwind v4, `@/components/ui` (Card, StatCard, ProgressBar, Badge, Skeleton, EmptyState, PageHeader), existing feature APIs.

---

## File Structure

- **Create:** `apps/web/app/(authed)/dashboard/page.tsx` — page chính, fetch + compose 5 widget
- **Modify:** `apps/web/components/layout/sidebar.tsx` — thêm lại mục Dashboard vào nav

---

### Task 1: Tạo route `/dashboard` và khung page

**Files:**
- Create: `apps/web/app/(authed)/dashboard/page.tsx`

- [ ] **Bước 1: Tạo file page với skeleton loading**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatVND } from '@/lib/format';
import { listUpcoming } from '@/features/important-dates/api';
import type { AgendaItem } from '@/features/important-dates/types';
import { getMonthlyReport } from '@/features/reports/api';
import type { MonthlyReport } from '@/features/reports/types';
import { listGoals } from '@/features/goals/api';
import type { GoalView } from '@/features/goals/types';
import { listTasks } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/types';
import { useAuthedLayout } from '../layout';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
  StatCard,
} from '@/components/ui';
import Link from 'next/link';

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
  const { user, funds } = useAuthedLayout();

  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<AgendaItem[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [yearGoal, setYearGoal] = useState<GoalView | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      listUpcoming(3),
      getMonthlyReport(now.getFullYear(), now.getMonth() + 1, 'all'),
      listGoals(),
      listTasks(getISOWeek(now)),
    ])
      .then(([upcomingView, rep, goals, taskList]) => {
        setUpcoming(upcomingView.items.slice(0, 3));
        setReport(rep);
        setYearGoal(goals.find((g) => g.period === 'year' && g.type === 'save') ?? null);
        setTasks(taskList);
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const spendingFunds = funds.filter((f) => f.purpose === 'spending');
  const incompleteTasks = tasks.filter((t) => t.status !== 'done');

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

          {/* Row 1: Sắp tới + Số dư quỹ */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <UpcomingWidget items={upcoming} loading={loading} locale={locale} />
            <FundsWidget funds={spendingFunds} loading={loading} />
          </div>

          {/* Row 2: Tháng này */}
          <MonthStatsWidget report={report} loading={loading} tReports={tReports} />

          {/* Row 3: Mục tiêu năm + Tasks */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <YearGoalWidget goal={yearGoal} loading={loading} t={t} />
            <TasksWidget incomplete={incompleteTasks} total={tasks.length} loading={loading} t={t} />
          </div>

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Bước 2: Thêm 5 widget sub-component vào cùng file**

Thêm phía dưới `DashboardPage`:

```tsx
// ─── UpcomingWidget ───────────────────────────────────────────────────────────

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

function UpcomingWidget({
  items,
  loading,
  locale,
}: {
  items: AgendaItem[];
  loading: boolean;
  locale: string;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">📅 Sắp tới</h3>
        <Link href="/important-dates" className="text-xs text-emerald-700 hover:text-emerald-900">
          Xem tất cả →
        </Link>
      </div>
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      )}
      {!loading && items.length === 0 && (
        <EmptyState icon="🗓️" title="Không có sự kiện sắp tới" description="" />
      )}
      {!loading && items.map((item, i) => (
        <div key={i} className="flex items-center justify-between border-b border-stone-100 py-2 last:border-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{KIND_LABELS[item.kind] ?? '📅'}</span>
            <div className="leading-tight">
              <div className="text-sm text-stone-800">{item.name}</div>
              <div className="text-[11px] text-stone-500">
                {new Date(item.occursOn).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
                  day: 'numeric',
                  month: 'long',
                })}
                {item.isLunar && ' (âm)'}
              </div>
            </div>
          </div>
          <span className={`shrink-0 text-xs font-semibold tabular-nums ${item.daysUntil === 0 ? 'text-rose-600' : item.daysUntil <= 3 ? 'text-amber-600' : 'text-stone-500'}`}>
            {item.daysUntil === 0 ? 'Hôm nay' : `${item.daysUntil} ngày`}
          </span>
        </div>
      ))}
    </Card>
  );
}

// ─── FundsWidget ──────────────────────────────────────────────────────────────

import type { FundView } from '@/features/funds/types';
import { pickFundIcon } from '@/features/funds/components/fund-card';

function FundsWidget({ funds, loading }: { funds: FundView[]; loading: boolean }) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">💰 Số dư quỹ</h3>
        <Link href="/transactions" className="text-xs text-emerald-700 hover:text-emerald-900">
          Giao dịch →
        </Link>
      </div>
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      )}
      {!loading && funds.map((f) => {
        const isPrivate = f.accessLevel === 'private';
        const tone = {
          owner: 'border-emerald-100 bg-emerald-50/40',
          joint: 'border-amber-100 bg-amber-50/40',
          private: 'border-stone-200 bg-stone-50',
        }[f.accessLevel];
        return (
          <div key={f.id} className={`flex items-center justify-between rounded-lg border ${tone} px-3 py-2.5 mb-2 last:mb-0`}>
            <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <span>{pickFundIcon(f)}</span> {f.name}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {isPrivate
                ? <span className="text-stone-300">— — — đ</span>
                : <span className="text-stone-900">{formatVND(f.balance ?? 0)}</span>}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

// ─── MonthStatsWidget ─────────────────────────────────────────────────────────

function MonthStatsWidget({
  report,
  loading,
  tReports,
}: {
  report: MonthlyReport | null;
  loading: boolean;
  tReports: ReturnType<typeof useTranslations>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">📊 Tháng này</h3>
        <Link href="/reports" className="text-xs text-emerald-700 hover:text-emerald-900">
          Chi tiết →
        </Link>
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

// ─── YearGoalWidget ───────────────────────────────────────────────────────────

function YearGoalWidget({
  goal,
  loading,
  t,
}: {
  goal: GoalView | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (loading) return <Card><Skeleton className="h-32 w-full rounded-lg" /></Card>;
  if (!goal) return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">🎯 Mục tiêu tiết kiệm năm</h3>
        <Link href="/goals" className="text-xs text-emerald-700 hover:text-emerald-900">Quản lý →</Link>
      </div>
      <EmptyState icon="🎯" title="Chưa có mục tiêu" description="Vào Goals để thiết lập" />
    </Card>
  );

  const pctRaw = (goal.currentProgress / Math.max(goal.targetAmount, 1)) * 100;
  const pct = Math.max(0, Math.min(100, pctRaw));
  const tone = goal.paceStatus === 'ahead' ? 'emerald' : goal.paceStatus === 'on_track' ? 'amber' : 'rose';
  const paceLabel = { ahead: 'Vượt tiến độ', on_track: 'Đúng tiến độ', behind: 'Chậm tiến độ' }[goal.paceStatus];
  const paceTone = { ahead: 'emerald', on_track: 'amber', behind: 'rose' }[goal.paceStatus] as 'emerald' | 'amber' | 'rose';

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">🎯 Mục tiêu tiết kiệm năm</h3>
        <div className="flex items-center gap-2">
          <Badge tone={paceTone}>{paceLabel}</Badge>
          <Link href="/goals" className="text-xs text-emerald-700 hover:text-emerald-900">Chi tiết →</Link>
        </div>
      </div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-xl font-semibold tabular-nums text-stone-900">
          {formatVND(goal.currentProgress)}
        </span>
        <span className="text-sm text-stone-500">
          / {formatVND(goal.targetAmount)}{' '}
          <span className="text-xs text-stone-400">({pctRaw.toFixed(1)}%)</span>
        </span>
      </div>
      <ProgressBar value={pct} max={100} tone={tone} />
      <div className="mt-2 text-[11px] text-stone-400">Còn {goal.daysRemaining} ngày</div>
    </Card>
  );
}

// ─── TasksWidget ──────────────────────────────────────────────────────────────

function TasksWidget({
  incomplete,
  total,
  loading,
  t,
}: {
  incomplete: Task[];
  total: number;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const done = total - incomplete.length;
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">✅ Tasks tuần này</h3>
        <Link href="/weekly" className="text-xs text-emerald-700 hover:text-emerald-900">
          Xem tất cả →
        </Link>
      </div>
      {loading && <Skeleton className="h-16 w-full rounded-lg" />}
      {!loading && total === 0 && (
        <EmptyState icon="✅" title="Không có task nào" description="" />
      )}
      {!loading && total > 0 && (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-stone-900">{incomplete.length}</span>
            <span className="text-sm text-stone-500">chưa xong / {total} task</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-1.5 text-[11px] text-stone-400">{done} / {total} hoàn thành</div>
          {incomplete.slice(0, 3).map((task) => (
            <div key={task.id} className="mt-2 flex items-center gap-2 text-sm text-stone-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              {task.title}
            </div>
          ))}
          {incomplete.length > 3 && (
            <div className="mt-1 text-[11px] text-stone-400">+{incomplete.length - 3} task khác</div>
          )}
        </>
      )}
    </Card>
  );
}
```

- [ ] **Bước 3: Chạy dev server kiểm tra compile**

```bash
pnpm --filter web dev
```

Mở `http://localhost:3000/dashboard`, kiểm tra page render không lỗi.

- [ ] **Bước 4: Kiểm tra loading skeleton hiển thị → data load đúng**

Reload trang, xác nhận:
- Skeleton xuất hiện khi đang fetch
- Sau khi load: upcoming items, fund balances, month stats, year goal, tasks hiển thị đúng

---

### Task 2: Thêm Dashboard vào sidebar navigation

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Bước 1: Thêm mục Dashboard vào group "finance"**

Trong `getNavGroups`, thêm dashboard làm item đầu tiên của group `finance`:

```tsx
{
  label: t("finance"),
  items: [
    { href: "/dashboard", label: t("overview"), icon: "📊" },
    { href: "/transactions", label: t("transactions"), icon: "💳" },
    { href: "/reports", label: t("reports"), icon: "📈" },
    { href: "/goals", label: t("savings_investment"), icon: "🏦" },
    { href: "/finance-settings", label: t("settings"), icon: "⚙️" },
  ],
},
```

- [ ] **Bước 2: Kiểm tra sidebar hiển thị đúng**

Mở `http://localhost:3000`, xác nhận mục "Tổng quan" (hoặc label đang dùng cho `overview`) xuất hiện đầu group Tài chính, click navigate đúng về `/dashboard`.

- [ ] **Bước 3: Đổi redirect sau login về `/dashboard`**

Kiểm tra các file redirect:
- `apps/web/app/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/register/page.tsx`
- `apps/web/app/invite/[token]/page.tsx`
- `apps/web/app/(authed)/family/setup/page.tsx`

Nếu chúng đang redirect về `/transactions` (do bước xóa dashboard trước đó), đổi lại thành `/dashboard`:

```bash
grep -n "'/transactions'" apps/web/app/page.tsx apps/web/app/login/page.tsx apps/web/app/register/page.tsx
```

Nếu có, dùng sed:

```bash
sed -i '' "s|router.replace('/transactions')|router.replace('/dashboard')|g" \
  apps/web/app/page.tsx \
  apps/web/app/login/page.tsx \
  apps/web/app/register/page.tsx \
  "apps/web/app/invite/[token]/page.tsx" \
  "apps/web/app/(authed)/family/setup/page.tsx"

sed -i '' "s|window.location.assign('/transactions')|window.location.assign('/dashboard')|g" \
  "apps/web/app/invite/[token]/page.tsx" \
  "apps/web/app/(authed)/family/setup/page.tsx"
```

- [ ] **Bước 4: Kiểm tra end-to-end**

Login lại hoặc navigate về `/`, xác nhận redirect đúng về `/dashboard`.
