# Financial Month Cutoff Day (Tháng tài chính)

## Bối cảnh

User nhận lương ngày 25 hàng tháng và muốn khoản lương đó tính vào "tháng tài chính kế tiếp". Tương tự với mọi giao dịch khác — họ xem "Tháng 5" = chi tiêu/thu nhập từ **25/04 → 24/05**, không phải 01/05 → 31/05.

Hiện tại toàn bộ API + UI assume calendar month (1/M → cuối tháng).

## Khái niệm

- **Calendar month**: tháng dương lịch, 1/M → cuối tháng.
- **Financial month** với cutoff `d`:
  - "Tháng N năm Y" = `[d/M-1 00:00 (UTC), d/M 00:00 (UTC))`.
  - Tức là start = ngày `d` của tháng trước, end exclusive = ngày `d` của tháng N.
  - Ví dụ cutoff=25, "Tháng 5/2026" = 25/04/2026 00:00 → 25/05/2026 00:00 (giao dịch ngày 25/05 đã thuộc Tháng 6).
- **Label rule**: tháng được đặt tên theo **end month** (tháng chứa end date). Vd 25/04→24/05 = "Tháng 5".
- **Backward compat**: cutoff=1 (default) → financial month = calendar month exact.
- **Clamp**: cutoff giới hạn 1–28 để mọi tháng (kể cả February) đều có ngày đó. Không cần clamp logic phức tạp.

## Quyết định

- Cutoff lưu vào `Family.financialMonthCutoffDay`, kiểu `smallint NOT NULL DEFAULT 1`, range 1–28.
- Mỗi family 1 cutoff (không per-user). Quỹ Chung lẫn quỹ cá nhân dùng chung.
- Toàn bộ query theo "tháng" (reports, envelope progress, transactions list filter) áp dụng cutoff.
- Goals **không đụng** — dùng explicit `startDate`/`deadline`.
- Important Dates calendar **không đụng** — đó là calendar dương lịch cho sinh nhật/kỷ niệm, khác semantics.
- UI hiển thị "Tháng 5" cho range 25/04→24/05; subtitle nhỏ "25/04 — 24/05" hiện cùng month switcher khi cutoff > 1.

## Thay đổi BE

### 1. `Family` entity

`apps/api/src/modules/families/entities/family.entity.ts` — thêm column:

```ts
@Column({ type: 'smallint', default: 1, name: 'financial_month_cutoff_day' })
financialMonthCutoffDay!: number;
```

Migration `AddFinancialMonthCutoffDay`: `ALTER TABLE families ADD COLUMN financial_month_cutoff_day smallint NOT NULL DEFAULT 1;`. Existing rows nhận giá trị 1 → behavior y nguyên.

### 2. Shared helper

`apps/api/src/shared/common/date-helpers.ts` (file mới):

```ts
export function getFinancialMonthRange(
  year: number,
  month: number,
  cutoffDay: number,
): { start: Date; end: Date } {
  // start = day=cutoffDay of (month-1) in UTC
  // end   = day=cutoffDay of (month) in UTC (exclusive)
  const start = new Date(Date.UTC(year, month - 2, cutoffDay));
  const end = new Date(Date.UTC(year, month - 1, cutoffDay));
  return { start, end };
}

export function getCurrentFinancialMonth(
  today: Date,
  cutoffDay: number,
): { year: number; month: number } {
  // Nếu today < cutoffDay trong tháng dương lịch hiện tại → financial month = tháng dương lịch hiện tại
  // Nếu today >= cutoffDay → financial month = tháng kế tiếp
  const d = today.getUTCDate();
  const m = today.getUTCMonth() + 1; // 1-indexed
  const y = today.getUTCFullYear();
  if (d < cutoffDay) return { year: y, month: m };
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
}
```

Unit test: cutoff=1 → range giống calendar month; cutoff=25 vd `(2026, 5, 25)` → start=2026-04-25 00:00 UTC, end=2026-05-25 00:00 UTC.

### 3. Reports service

`apps/api/src/modules/reports/reports.service.ts`:

- Inject `FamiliesService` để query family của user.
- Trong `monthly(userId, year, month, scope, fundId)`:
  - Lookup `family.financialMonthCutoffDay`.
  - Thay 2 dòng tính start/end (53–54) bằng `getFinancialMonthRange(year, month, cutoffDay)`.
  - Filter: `transaction.date >= start AND transaction.date < end` (chú ý: **half-open**, end exclusive).
- `emptyDays(year, month, cutoffDay)`:
  - Sinh array day buckets từ `start` → `end - 1ms`. Trong financial month dài 28–31 ngày tùy tháng.
  - Mỗi bucket có `date` (ISO yyyy-mm-dd), `income`, `expense`.

### 4. Funds service — envelope progress

`apps/api/src/modules/funds/funds.service.ts:134-159`:

- Tính `(currentYear, currentMonth) = getCurrentFinancialMonth(now, cutoffDay)`.
- `{ start, end } = getFinancialMonthRange(currentYear, currentMonth, cutoffDay)`.
- SQL filter: `t.date >= :start AND t.date < :end`.

### 5. Family API

`apps/api/src/modules/families/families.controller.ts`:

- `GET /api/families/me` (hoặc endpoint hiện có trả về family): bao gồm `financialMonthCutoffDay` trong response.
- `PATCH /api/families/me` (hoặc endpoint update): chấp nhận `financialMonthCutoffDay` (number, 1–28, validate via class-validator `@IsInt() @Min(1) @Max(28)`).

Nếu hai endpoint chưa tồn tại → tạo mới trong scope task này.

### 6. Goals + Transactions — không đụng BE

- Goals: dùng explicit dates, không liên quan.
- Transactions list endpoint: FE đang truyền `from`/`to` query params → FE compute range bằng helper, BE pass-through.

## Thay đổi FE

### 1. Types

`apps/web/features/families/types.ts` — thêm `financialMonthCutoffDay: number` vào `FamilyView`.

### 2. Shared helper

`apps/web/lib/financial-month.ts` (file mới): port `getFinancialMonthRange` + `getCurrentFinancialMonth` từ BE (giống signature).

### 3. Layout / context

`apps/web/app/(authed)/layout.tsx` đã fetch family qua `useAuthedLayout()`. Expose `cutoffDay` từ family object xuống các page.

### 4. Pages dùng month switcher

**`apps/web/app/(authed)/dashboard/page.tsx`**:
- Seed `year`/`month` initial bằng `getCurrentFinancialMonth(new Date(), cutoffDay)` thay vì `now.getFullYear()/getMonth()+1`.
- `MonthSwitcher`: thêm prop `cutoffDay`. Khi `cutoffDay > 1`, render subtitle nhỏ "25/04 — 24/05" dưới `monthLabel`.
- `isCurrentMonth` so sánh với `getCurrentFinancialMonth(today, cutoffDay)` thay vì calendar.

**`apps/web/app/(authed)/transactions/page.tsx:81-82`**: thay 2 dòng tính start/end calendar bằng:
```ts
const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
```
Truyền `start` và `end - 1ms` (hoặc giữ half-open nếu API hỗ trợ) vào API call.

**`apps/web/features/transactions/components/month-switcher.tsx:18`**: thêm prop `cutoffDay`, render subtitle range giống dashboard.

### 5. Finance settings page

`apps/web/app/(authed)/finance-settings/page.tsx`: thêm section mới **"Tháng tài chính"**:

- Input number, label "Ngày bắt đầu tháng tài chính", min=1, max=28, default=1.
- Hint: "Cutoff=25 nghĩa là Tháng 5 tính từ 25/04 đến 24/05. Mặc định 1 = tháng dương lịch."
- Save button → `PATCH /api/families/me` với field `financialMonthCutoffDay`.
- Toast success + invalidate cache (reload page hoặc refetch family).

### 6. i18n

`messages/vi.json` + `messages/en.json`, namespace `finance_settings` (đã có) hoặc namespace mới:
- `financial_month_section_title`: "Tháng tài chính" / "Financial month"
- `financial_month_cutoff_label`: "Ngày bắt đầu tháng tài chính" / "Financial month start day"
- `financial_month_cutoff_hint`: "Cutoff=25 nghĩa là Tháng 5 tính từ 25/04 đến 24/05. Mặc định 1 = tháng dương lịch." / "Cutoff=25 means Month 5 spans 25/04 → 24/05. Default 1 = calendar month."
- Subtitle format dùng existing `formatDate` / locale-aware.

## Không làm

- Không retroactively re-classify transactions cũ.
- Không hỗ trợ cutoff khác per-user, per-fund.
- Không clamp range > 28 (UI block).
- Không đụng goals, important-dates calendar.

## Edge cases

- **`cutoffDay = 1`**: behavior identical to calendar. UI không show subtitle range.
- **`cutoffDay > 1`**: UI luôn show subtitle "25/04 — 24/05" cạnh month label để user không confuse.
- **Financial month chứa cuối năm**: cutoff=25, "Tháng 1/2027" = 25/12/2026 → 25/01/2027. Helper xử lý qua `Date.UTC(year, month-2, ...)` (JS `Date` tự overflow month sang năm trước/sau).
- **Change cutoff ở giữa năm**: existing transactions giữ nguyên `date`. Sau khi đổi cutoff, mọi report tự update theo cutoff mới. KHÔNG có migration data.
- **DST / timezone**: dùng UTC trong helper. Display dùng `Asia/Ho_Chi_Minh` (vẫn so sánh đúng vì offset cố định +07).

## Verification

- BE: unit test helper với cutoff=1, 15, 28, cross-year case.
- BE: integration test reports.monthly với cutoff=25, transactions ngày 24/25/26/04 — confirm phân bổ đúng.
- FE: smoke test `pnpm --filter web dev`:
  - Đổi cutoff trong `/finance-settings` → save thành công.
  - Dashboard month switcher: với cutoff=25, "Tháng 5" hiển thị subtitle "25/04 — 24/05".
  - Tạo transaction ngày 25/04 → xuất hiện trong "Tháng 5" (không phải "Tháng 4").
  - Trang transactions filter "Tháng 5" → chỉ list giao dịch trong 25/04 → 24/05.

## Risks

- **Blast radius medium**: 3 BE services, 3 FE pages, 1 migration. Nhưng default=1 → mọi existing user/test không bị ảnh hưởng.
- **i18n drift**: `month_label` (vd "Tháng 5") không nói rõ là financial — subtitle range mitigate.
- **Bug nguy hiểm nhất**: off-by-one ở boundary (giao dịch ngày 25/04 thuộc Tháng 4 hay Tháng 5?). Convention: **end exclusive** → 25/04 thuộc Tháng 5 (start của Tháng 5). Helper + test phải lock điều này.
