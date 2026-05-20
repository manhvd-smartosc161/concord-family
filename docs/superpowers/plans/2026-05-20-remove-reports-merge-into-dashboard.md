# Bỏ trang Báo cáo, gộp Chi tiêu theo danh mục vào Tổng quan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa trang `/reports` khỏi `apps/web` và đưa phần Chi tiêu theo danh mục vào Tổng quan (`/dashboard`), dùng chung fund filter + month switcher với MonthStatsWidget.

**Architecture:** Pure frontend refactor — không đụng BE. Tổng quan re-use `getMonthlyReport()` đã có (`report.byCategory`), một call API feed cả MonthStats và Category breakdown. Daily chart bị bỏ luôn.

**Tech Stack:** NextJS 16 App Router, React 19, Tailwind v4, next-intl. Project không có test runner cho web — verification dựa vào `pnpm --filter web build` + smoke test thủ công.

**Spec:** [docs/superpowers/specs/2026-05-20-remove-reports-merge-into-dashboard-design.md](../specs/2026-05-20-remove-reports-merge-into-dashboard-design.md)

---

## File Structure

- **Modify**: `apps/web/app/(authed)/dashboard/page.tsx` — thêm state year/month, MonthSwitcher, CategoryBreakdownWidget
- **Modify**: `apps/web/components/layout/sidebar.tsx` — xóa entry `/reports`
- **Modify**: `apps/web/messages/vi.json`, `apps/web/messages/en.json` — cleanup keys
- **Delete**: `apps/web/app/(authed)/reports/page.tsx` (+ folder rỗng `apps/web/app/(authed)/reports/`)
- **Keep**: `apps/web/features/reports/{api.ts,types.ts}` — vẫn dùng cho dashboard

---

### Task 1: Xóa entry `/reports` khỏi sidebar

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx:28`
- Modify: `apps/web/messages/vi.json:32`
- Modify: `apps/web/messages/en.json:32`

- [ ] **Step 1: Xóa nav item trong sidebar**

Sửa `apps/web/components/layout/sidebar.tsx`, xóa dòng entry `/reports`:

```tsx
    {
      label: t("finance"),
      items: [
        { href: "/transactions", label: t("transactions"), icon: "💳" },
        { href: "/debts", label: t("debts"), icon: "🧾" },
        { href: "/goals", label: t("savings_investment"), icon: "🏦" },
        { href: "/finance-settings", label: t("settings"), icon: "⚙️" },
      ],
    },
```

(Xóa dòng `{ href: "/reports", label: t("reports"), icon: "📈" },`.)

- [ ] **Step 2: Xóa key `nav.reports` trong vi.json**

Sửa `apps/web/messages/vi.json`, xóa dòng `"reports": "Báo cáo",` trong namespace `nav`. Sau khi sửa, namespace `nav` còn:

```json
  "nav": {
    "overview": "Tổng quan",
    "ai_assistant": "Trợ lý AI",
    "finance": "Tài chính",
    "transactions": "Giao dịch",
    "debts": "Nợ & Cho vay",
    "savings_investment": "Tiết kiệm & Đầu tư",
    "settings": "Cài đặt",
    "family_group": "Gia đình",
    "tasks": "Công việc",
    "anniversaries": "Ngày kỷ niệm",
    "members": "Thành viên",
    "your_funds": "Quỹ của bạn",
    "profile": "Hồ sơ"
  },
```

- [ ] **Step 3: Xóa key `nav.reports` trong en.json**

Sửa `apps/web/messages/en.json`, xóa dòng `"reports": "Reports",` trong namespace `nav`.

- [ ] **Step 4: Verify build pass**

Run: `pnpm --filter web build`
Expected: build succeed, không lỗi i18n missing key.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx apps/web/messages/vi.json apps/web/messages/en.json
git commit -m "chore(web): remove reports entry from sidebar"
```

---

### Task 2: Thêm state year/month + MonthSwitcher vào dashboard

**Files:**
- Modify: `apps/web/app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Thêm state year/month + sửa effect**

Trong `DashboardPage`, thêm state `year`, `month` và sửa effect fetch report.

Sau block `const [reportFundId, setReportFundId] = useState<string>('');` thêm:

```tsx
  const now0 = new Date();
  const [year, setYear] = useState(now0.getFullYear());
  const [month, setMonth] = useState(now0.getMonth() + 1);
```

Sửa effect đầu tiên (chạy lần đầu fetch tất cả) — thay `now.getFullYear(), now.getMonth() + 1` bằng `year, month`:

```tsx
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
```

Sửa effect thứ hai (chạy khi đổi fund) — đổi dependency từ `[reportFundId]` thành `[reportFundId, year, month]` và dùng `year, month` thay vì `now.getFullYear(), now.getMonth() + 1`:

```tsx
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
```

- [ ] **Step 2: Truyền year/month/onShift xuống MonthStatsWidget**

Trong JSX của `DashboardPage`, sửa block render `<MonthStatsWidget ... />`:

```tsx
          <MonthStatsWidget
            report={report}
            loading={loading || reportLoading}
            funds={spendingFunds}
            selectedFundId={reportFundId}
            onFundChange={setReportFundId}
            year={year}
            month={month}
            onShift={shiftMonth}
            t={t}
            tReports={tReports}
          />
```

Thêm helper `shiftMonth` ngay trước block `return (` của `DashboardPage`:

```tsx
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
```

- [ ] **Step 3: Update signature và body của MonthStatsWidget**

Sửa signature của `MonthStatsWidget`, bỏ link `/reports`, thêm `MonthSwitcher`:

```tsx
function MonthStatsWidget({
  report,
  loading,
  funds,
  selectedFundId,
  onFundChange,
  year,
  month,
  onShift,
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
  t: TFn;
  tReports: TFn;
}) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">📊 {t('month_title')}</h3>
        <MonthSwitcher
          year={year}
          month={month}
          onShift={onShift}
          isCurrent={isCurrentMonth}
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
```

Thay đổi vs trước:
- Bỏ block `<Link href="/reports">{t('month_detail')}</Link>`.
- Thêm `<MonthSwitcher ... />` (sẽ định nghĩa Step 4).
- Header dùng `items-center` thay vì `items-baseline` để align nút switcher.

- [ ] **Step 4: Thêm component MonthSwitcher (copy từ reports cũ)**

Thêm ở cuối file `apps/web/app/(authed)/dashboard/page.tsx` (sau `TasksWidget`):

```tsx
function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
  tReports,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
  tReports: TFn;
}) {
  const locale = useLocale();
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'vi-VN',
    { month: 'long', year: 'numeric' },
  );
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label={tReports('current_month')}
      >
        <ChevronIcon dir="left" />
      </button>
      <div className="min-w-[140px] px-3 py-1 text-center text-sm font-medium text-foreground">
        {monthLabel}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={tReports('current_month')}
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
```

- [ ] **Step 5: Verify build pass**

Run: `pnpm --filter web build`
Expected: build succeed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(authed\)/dashboard/page.tsx
git commit -m "feat(web): add month switcher to dashboard month stats"
```

---

### Task 3: Thêm CategoryBreakdownWidget vào dashboard

**Files:**
- Modify: `apps/web/app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Thêm import CategoryAggregate type**

Trong `apps/web/app/(authed)/dashboard/page.tsx`, sửa import:

```tsx
import type { MonthlyReport, CategoryAggregate } from '@/features/reports/types';
```

(Thay vì chỉ `MonthlyReport`.)

- [ ] **Step 2: Render CategoryBreakdownWidget trong DashboardPage**

Trong JSX của `DashboardPage`, thêm `<CategoryBreakdownWidget />` ngay sau `<MonthStatsWidget ... />`:

```tsx
          <MonthStatsWidget
            report={report}
            loading={loading || reportLoading}
            funds={spendingFunds}
            selectedFundId={reportFundId}
            onFundChange={setReportFundId}
            year={year}
            month={month}
            onShift={shiftMonth}
            t={t}
            tReports={tReports}
          />
          <CategoryBreakdownWidget
            report={report}
            loading={loading || reportLoading}
            tReports={tReports}
          />
          <DebtSummaryWidget summary={debtSummary} loading={loading || debtLoading} t={t} />
```

- [ ] **Step 3: Thêm component CategoryBreakdownWidget**

Thêm vào cuối file `apps/web/app/(authed)/dashboard/page.tsx` (sau `MonthSwitcher` đã thêm Task 2):

```tsx
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
```

- [ ] **Step 4: Verify build pass**

Run: `pnpm --filter web build`
Expected: build succeed.

- [ ] **Step 5: Smoke test thủ công**

Run: `pnpm --filter web dev` (background), mở `http://localhost:3000/dashboard`.
Expected:
- Tổng quan hiện section "📊 Chi tiêu theo danh mục" dưới MonthStats.
- Đổi fund tab (Quỹ Chung / Vợ / Chồng) → category list update.
- Bấm `←` month switcher → category list update tháng trước.
- Bấm `→` ở tháng hiện tại → nút disabled.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(authed\)/dashboard/page.tsx
git commit -m "feat(web): add expense by category widget to dashboard"
```

---

### Task 4: Xóa trang /reports và cleanup i18n

**Files:**
- Delete: `apps/web/app/(authed)/reports/page.tsx`
- Delete folder: `apps/web/app/(authed)/reports/`
- Modify: `apps/web/messages/vi.json:189-204`
- Modify: `apps/web/messages/en.json:189-204`
- Modify: `apps/web/app/(authed)/dashboard/page.tsx` (xóa key `month_detail` không còn dùng)

- [ ] **Step 1: Xóa file page reports**

Run:
```bash
rm apps/web/app/\(authed\)/reports/page.tsx
rmdir apps/web/app/\(authed\)/reports
```

- [ ] **Step 2: Cleanup namespace `reports` trong vi.json**

Sửa `apps/web/messages/vi.json`, namespace `reports` thành (giữ key dashboard còn dùng, bỏ `title`, `subtitle`, `chart_income`, `chart_expense`):

```json
  "reports": {
    "income": "Tháng này — thu",
    "expense": "Tháng này — chi",
    "net": "Tháng này — net",
    "txn_count": "{count} giao dịch tổng",
    "categories_count": "{count} mục có chi tiêu",
    "net_hint": "Thu trừ chi",
    "no_data": "Không có dữ liệu",
    "no_data_desc": "Chưa có giao dịch nào trong tháng này.",
    "expense_by_category": "Chi tiêu theo danh mục",
    "current_month": "Tháng hiện tại"
  },
```

- [ ] **Step 3: Cleanup namespace `reports` trong en.json**

Sửa `apps/web/messages/en.json` tương tự:

```json
  "reports": {
    "income": "This month — income",
    "expense": "This month — expense",
    "net": "This month — net",
    "txn_count": "{count} total transactions",
    "categories_count": "{count} categories with spending",
    "net_hint": "Income minus expense",
    "no_data": "No data",
    "no_data_desc": "No transactions this month.",
    "expense_by_category": "Expense by category",
    "current_month": "Current month"
  },
```

- [ ] **Step 4: Xóa key `dashboard.month_detail` trong vi.json**

Sửa `apps/web/messages/vi.json:396`, xóa dòng `"month_detail": "Chi tiết →",` trong namespace `dashboard` (key này dùng cho link "→ /reports" đã bỏ ở Task 2).

- [ ] **Step 5: Xóa key `dashboard.month_detail` trong en.json**

Sửa `apps/web/messages/en.json:396`, xóa dòng `"month_detail": "Details →",`.

- [ ] **Step 6: Verify build pass + route 404**

Run: `pnpm --filter web build`
Expected: build succeed.

Run: `pnpm --filter web dev` (background), truy cập `http://localhost:3000/reports`.
Expected: 404 (route đã xóa).

- [ ] **Step 7: Commit**

```bash
git add -u apps/web/app/\(authed\)/ apps/web/messages
git commit -m "chore(web): remove reports page and cleanup i18n keys"
```

---

## Self-Review

**Spec coverage:**
- ✅ Bỏ daily chart → Task 4 (xóa toàn bộ `reports/page.tsx`).
- ✅ Category breakdown dùng chung fund filter → Task 3 (re-use `report` state, không thêm filter mới).
- ✅ Month switcher cho cả MonthStats + Category → Task 2 (MonthSwitcher trong MonthStatsWidget) + Task 3 (CategoryBreakdownWidget dùng cùng `report`).
- ✅ Bỏ link `/reports` trong sidebar → Task 1.
- ✅ Xóa file `reports/page.tsx` → Task 4 Step 1.
- ✅ Giữ `features/reports/` → không có task nào xóa.
- ✅ Cleanup i18n → Task 4 Step 2-5.
- ✅ Edge cases: disable `→` ở tháng hiện tại (Task 2 Step 3), empty `byCategory` (Task 3 Step 3), loading skeleton (Task 3 Step 3).

**Placeholder scan:** Không có TBD/TODO. Mọi step có code block đầy đủ.

**Type consistency:**
- `MonthSwitcher` props: `year, month, onShift, isCurrent, tReports` — khớp giữa Task 2 Step 3 (caller) và Task 2 Step 4 (definition).
- `CategoryBreakdownWidget` props: `report, loading, tReports` — khớp giữa Task 3 Step 2 (caller) và Task 3 Step 3 (definition).
- `shiftMonth(delta: number)` — định nghĩa Task 2 Step 2, truyền vào MonthStatsWidget Task 2 Step 2.

Plan hoàn chỉnh.
