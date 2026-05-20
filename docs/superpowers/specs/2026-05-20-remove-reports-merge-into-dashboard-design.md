# Bỏ trang Báo cáo, gộp Chi tiêu theo danh mục vào Tổng quan

## Bối cảnh

Hiện tại `apps/web` có 2 trang trùng concept tài chính tháng:

- `/dashboard` (Tổng quan) — có `MonthStatsWidget` (income / expense / net) với fund filter, chỉ tháng hiện tại.
- `/reports` (Báo cáo) — có 3 phần: stats (trùng với dashboard), biểu đồ theo ngày (DailyChart), chi tiêu theo danh mục.

User muốn:

1. Bỏ trang `/reports`.
2. Đưa phần **Chi tiêu theo danh mục** sang Tổng quan.
3. Daily chart bỏ luôn — không chuyển sang đâu khác.

## Quyết định

- **Bỏ daily chart**: không chuyển sang Tổng quan.
- **Category breakdown** dùng chung fund filter với `MonthStatsWidget` (không tách filter riêng).
- **Thêm month switcher** vào Tổng quan, áp dụng cho cả MonthStats + Category breakdown (re-use một call API).
- Module BE `reports` giữ nguyên — vẫn cần `GET /api/reports/monthly` cho dashboard.
- `features/reports/` (FE feature slice) giữ lại — vẫn dùng `getMonthlyReport`, types.

## Thay đổi

### 1. `apps/web/app/(authed)/dashboard/page.tsx`

- Thêm state `year`, `month` default = tháng hiện tại.
- Sửa `MonthStatsWidget`:
  - Header thêm `MonthSwitcher` (copy từ `reports/page.tsx`).
  - Bỏ link "Xem chi tiết → /reports" (trang không còn).
- `useEffect` fetch report: re-fetch khi `year | month | reportFundId` đổi.
- Thêm widget mới **`CategoryBreakdownWidget`** ngay dưới `MonthStatsWidget`:
  - Re-use `report.byCategory` và `report.expense` từ state đã fetch (không call API thêm).
  - Header: `📊 {t('reports.expense_by_category')}`.
  - Empty state khi `byCategory.length === 0`.
  - Loading skeleton 5 dòng.
  - Logic render: copy `CategoryList` từ `reports/page.tsx`.

### 2. Xóa trang `/reports`

- Xóa file `apps/web/app/(authed)/reports/page.tsx`.
- Xóa folder rỗng `apps/web/app/(authed)/reports/`.
- `features/reports/{api.ts,types.ts}` **giữ nguyên**.

### 3. Sidebar `apps/web/components/layout/sidebar.tsx`

- Xóa entry `{ href: "/reports", label: t("reports"), icon: "📈" }` khỏi mảng `NAV`.

### 4. i18n (`messages/vi.json`, `messages/en.json`)

- Xóa key `nav.reports` (chỉ dùng cho sidebar đã xóa).
- Trong namespace `reports.*`:
  - Giữ: `income`, `expense`, `net`, `net_hint`, `txn_count`, `categories_count`, `expense_by_category`, `no_data`, `no_data_desc`, `current_month` (vẫn dùng làm aria-label cho month switcher).
  - Xóa: `title`, `subtitle`, `chart_income`, `chart_expense` (chỉ trang reports và daily chart dùng).
- Trong `dashboard`: bỏ key `month_detail` (link "→ /reports" đã xóa).

## Data flow

```
year / month / reportFundId  ─┐
                              ▼
              getMonthlyReport(year, month, scope, fundId)
                              │
                              ▼
                       report state
                       ├──► MonthStatsWidget (income/expense/net)
                       └──► CategoryBreakdownWidget (byCategory + expense)
```

Một call API, hai widget dùng chung — đúng nguyên tắc YAGNI, không duplicate fetch.

## Edge cases

- **Month switcher**: disable nút `→` khi đang ở tháng hiện tại (giống logic `isCurrentMonth` cũ).
- **Empty `byCategory`**: `<EmptyState icon="📭" title={t('reports.no_data')} description={t('reports.no_data_desc')} />`.
- **Loading**: skeleton 5 dòng (giống reports cũ).
- **Fund filter mặc định**: vẫn là Quỹ Chung (`reportFundId = ''` → scope='joint').

## Không làm

- Không refactor widget ra file riêng (giữ pattern inline widget trong `dashboard/page.tsx`).
- Không đụng BE module `reports`.
- Không thêm date range picker — chỉ month switcher đơn giản giống reports cũ.
- Không migrate sang React Query trong PR này.

## Verification

- `pnpm --filter web build` pass.
- Smoke test thủ công:
  - `/dashboard` hiển thị MonthStats + Category breakdown.
  - Month switcher: bấm `←` → fetch lại data tháng trước; bấm `→` ở tháng hiện tại → disabled.
  - Đổi fund tab (Quỹ Chung / Vợ / Chồng) → cả 2 widget update.
  - Truy cập trực tiếp `/reports` → 404 (route đã xóa).
  - Sidebar không còn entry "Báo cáo".
