# Responsive design cho Concord web (apps/web)

**Date**: 2026-05-08
**Status**: Approved (brainstorming → ready for implementation plan)
**Scope**: `apps/web` only. Không đụng API, business logic, types.

## Mục tiêu

Hiện `apps/web` là **desktop-only** — layout grid fix `grid-cols-[280px_1fr]`, sidebar 280px luôn mounted, không có mobile breakpoint. Mục tiêu: làm toàn bộ web app responsive **mobile-first ≥360px**, vẫn giữ desktop UX nguyên vẹn.

Không phải redesign — refactor responsive theo Tailwind breakpoints. UI structure, copy, color palette, business flow giữ nguyên.

## Quyết định đã chốt (từ brainstorming)

| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| 1 | Target device | Mobile-first ≥360px (iPhone SE trở lên) |
| 2 | Sidebar trên mobile | Drawer trượt từ trái, nút ☰ trong header |
| 3 | Transactions toolbar | Nén filter/search vào nút "Bộ lọc" expand. Modal/day-group/pagination giữ nguyên, chỉ shrink padding |
| 4 | Chat session list | Drawer riêng, mở bằng nút "Lịch sử" trong header chat |
| 5 | Dashboard grid mobile | 1 cột stack toàn bộ |
| 6 | Charts (Reports) | `ResponsiveContainer` width 100%, height ~240px mobile |

## Approach

**A — Tailwind responsive in-place** (đã chọn). Refactor từng page bằng Tailwind breakpoints class. Thêm 1 component mới duy nhất là `MobileDrawer` reusable cho sidebar + chat session list. Không introduce primitive nào khác (YAGNI).

Loại Approach B (extract nhiều primitive — over-engineering) và C (mobile route group fork — 2x maintenance).

## Breakpoint strategy

Dùng default Tailwind v4:

| Breakpoint | Width | Mục đích |
|-----------|-------|----------|
| `< sm` | < 640px | Mobile (phone). 1 cột, drawer NAV, padding nhỏ |
| `sm` | ≥ 640px | Phablet / phone landscape. Vẫn drawer; vài grid bắt đầu chia 2 |
| `md` | ≥ 768px | Tablet portrait. Drawer vẫn ẩn (chưa có chỗ cho 280px sidebar) |
| `lg` | ≥ 1024px | Desktop. Sidebar fixed 280px như hiện tại |

**Cutoff sidebar = `lg`**. Dưới `lg` đều dùng drawer.

## Layout shell — `app/(authed)/layout.tsx`

### Hiện tại

```tsx
<div className="grid h-screen grid-cols-[280px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)]">
  <Header user={...} onLogout={...} />
  <Sidebar funds={funds} />
  <main className="min-h-0 overflow-hidden bg-stone-50">{children}</main>
</div>
```

### Sau refactor

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);

return (
  <LayoutContext.Provider value={{ user, funds, reloadFunds }}>
    {/* Mobile/tablet: flex column */}
    <div className="flex h-screen flex-col lg:hidden">
      <Header
        user={auth.user}
        onLogout={() => logout(router)}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="min-h-0 flex-1 overflow-hidden bg-stone-50">{children}</main>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Sidebar funds={funds} onNavigate={() => setDrawerOpen(false)} />
      </MobileDrawer>
    </div>

    {/* Desktop: grid như cũ */}
    <div className="hidden h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-[64px_minmax(0,1fr)]">
      <Header user={auth.user} onLogout={() => logout(router)} />
      <Sidebar funds={funds} />
      <main className="min-h-0 overflow-hidden bg-stone-50">{children}</main>
    </div>
  </LayoutContext.Provider>
);
```

Tách 2 branch JSX rõ ràng — không nhồi conditional className phức tạp. Trade-off: duplicate `<Header/>` markup, nhưng đọc rõ hơn.

## New component — `components/ui/mobile-drawer.tsx`

```tsx
interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';        // default 'left'
  widthClass?: string;              // default 'w-[280px]'
  children: React.ReactNode;
}
```

Behavior:
- `open=false` → render nothing
- `open=true` → portal (`createPortal` về `document.body`):
  - Backdrop `fixed inset-0 bg-black/40 z-40` (click → `onClose()`)
  - Panel `fixed inset-y-0 {left-0|right-0} {widthClass} bg-white shadow-xl z-50 overflow-y-auto`
  - Slide-in: `transform transition-transform duration-200`, mount với `-translate-x-full` (left) → next tick `translate-x-0`
- Esc key listener (`useEffect` add/remove)
- Body scroll lock: `useEffect` set/restore `document.body.style.overflow`
- Wrapper class `lg:hidden` defensive — desktop không render gì cả

Tự viết, không lib ngoài (project chưa có headless-ui/radix).

Export thêm trong `components/ui/index.tsx`.

## Component update — không tạo mới

### `components/layout/header.tsx`

Thêm:
- Prop `onMenuClick?: () => void`
- Nút `<button className="lg:hidden mr-2" onClick={onMenuClick}>☰</button>` ở đầu, trước logo
- User dropdown trigger:
  - Mobile: chỉ hiện avatar (ẩn name + meta) hoặc avatar + truncated name
  - `sm` trở lên hiện đầy đủ như hiện tại
- Padding header `px-3 sm:px-4 lg:px-6`

### `components/layout/sidebar.tsx`

Thêm:
- Prop `onNavigate?: () => void`
- NAV `<Link>` thêm `onClick={() => onNavigate?.()}` để click 1 NAV item trên mobile sẽ đóng drawer

Nội dung sidebar (NAV + fund cards) **không đổi**.

## Per-page changes

### Common

- `<PageHeader>` padding inline: `px-3 sm:px-4 lg:px-6`
- `<main>` content wrapper: `px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6`
- Mọi `max-w-6xl mx-auto` giữ nguyên — đã work trên mobile

### `login/page.tsx`

Form đã centered. Thêm `px-4` ngoài card để input không sát mép. Font/spacing scale xuống nếu quá lớn.

### `dashboard/page.tsx`

Đã có `grid-cols-1 sm:grid-cols-3` và `grid-cols-1 lg:grid-cols-[1fr_1.2fr]` — giữ.

Sửa:
- Line 214 `grid-cols-3` (sub-stat trong card) → `grid-cols-1 sm:grid-cols-3` (3 cột số 360px sẽ vỡ)
- Recent transaction row: shrink padding, ẩn `invisible group-hover` → tap-to-reveal hoặc luôn hiện compact actions
- Stat card font size scale: `text-xl sm:text-2xl` cho số tiền lớn

### `transactions/page.tsx`

- Toolbar (search input + month-switcher + filter): collapse vào nút "Bộ lọc" mobile. Inline state `const [filterOpen, setFilterOpen] = useState(false)`. Month switcher luôn hiện.
- `day-group` component (`features/transactions/components/day-group.tsx`): shrink padding `p-3 sm:p-4`, row giao dịch cho phép wrap số tiền xuống dòng
- Pagination buttons: min-height 44px tap target
- Edit transaction modal (`features/transactions/components/edit-transaction-modal.tsx`): padding mobile `p-4 sm:p-6`, buttons full-width stack

### `reports/page.tsx`

- Tab switcher (joint/personal/Mạnh/Wife): wrap container `overflow-x-auto` mobile
- Charts: thay fixed height bằng `<ResponsiveContainer width="100%" height={240}>` mobile, `300` desktop. Có thể dùng `useEffect + window.matchMedia` hoặc 2 ResponsiveContainer với `hidden lg:block`. Chọn cách thứ 2 cho đơn giản.
- Legend dưới chart, font-size `text-xs sm:text-sm`

### `goals/page.tsx`

- Goal cards grid: `grid-cols-1 lg:grid-cols-2`
- Form add/edit goal: full-width inputs, button row stack `flex-col sm:flex-row`
- Goal detail panel (nếu có): full-width mobile

### `important-dates/page.tsx`

- Agenda items (`features/important-dates/components/agenda-item-card.tsx`): shrink padding, ẩn meta phụ trên mobile (chỉ hiện title + date)
- Reminder chips: scroll-x ngang nếu nhiều

### `important-dates/year/page.tsx`

- Calendar grid 12 tháng: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Day cells trong mỗi tháng: tap target tối thiểu 32px

### `settings/page.tsx`

- Form sections stack 1 cột mobile
- Label trên input thay vì 2-col label-input layout
- Buttons stack `flex-col sm:flex-row`

### `chat/page.tsx` (lớn nhất, 833 dòng)

- Session list panel (left): trên `< lg` ẩn, render qua `<MobileDrawer side="left">` riêng (state cục bộ `[sessionDrawerOpen, setSessionDrawerOpen]`)
- Header chat: thêm nút "Lịch sử" `lg:hidden` ở mobile để mở session drawer; ẩn meta dài
- Message bubbles: `max-w-[85%] lg:max-w-[70%]`
- Suggestion chips row: `overflow-x-auto` ngang
- Composer: fix bottom với `pb-[env(safe-area-inset-bottom)]`, input grow, send button compact icon-only mobile
- Padding messages container `px-3 sm:px-4 lg:px-6`

## Out of scope

- shadcn/ui setup (CLAUDE.md cấm setup mà không discuss trước)
- Dark mode
- Refactor 3 page lớn (chat 833 dòng, goals 682, dashboard 558) sang sub-components. Chỉ chỉnh class responsive — split file là follow-up riêng
- Bottom navigation pattern
- Swipe gesture để đóng drawer (Esc + backdrop click + click NAV item đủ MVP)
- Touch haptic / native-feel transition
- Visual regression test infra

## Testing strategy

Manual qua Chrome DevTools device toolbar:
- **iPhone SE** (375 × 667) — smallest target
- **iPhone 12** (390 × 844) — common modern
- **iPad Mini** (768 × 1024) — tablet boundary
- **Desktop** (1280 × 800) — verify không regress

Smoke test mỗi page:
- Load page không lỗi
- Drawer open/close (sidebar + chat session)
- Tap targets ≥ 44px (button, NAV link, pagination)
- Edit transaction modal open/save
- Chat send message
- Charts render đúng width
- No horizontal page scroll (overflow-x clean)

Run `pnpm --filter web lint` + `pnpm --filter web build` ở cuối — phải pass.

## Files affected

**New (1)**:
- `apps/web/components/ui/mobile-drawer.tsx`

**Edit (~14)**:
- `apps/web/app/(authed)/layout.tsx`
- `apps/web/components/layout/header.tsx`
- `apps/web/components/layout/sidebar.tsx`
- `apps/web/components/ui/index.tsx` (export drawer)
- `apps/web/app/login/page.tsx`
- `apps/web/app/(authed)/dashboard/page.tsx`
- `apps/web/app/(authed)/transactions/page.tsx`
- `apps/web/app/(authed)/reports/page.tsx`
- `apps/web/app/(authed)/goals/page.tsx`
- `apps/web/app/(authed)/important-dates/page.tsx`
- `apps/web/app/(authed)/important-dates/year/page.tsx`
- `apps/web/app/(authed)/settings/page.tsx`
- `apps/web/app/(authed)/chat/page.tsx`
- `apps/web/features/transactions/components/edit-transaction-modal.tsx` (modal padding)
- `apps/web/features/transactions/components/day-group.tsx` (shrink padding)
- `apps/web/features/transactions/components/month-switcher.tsx` (mobile compact)
- `apps/web/features/important-dates/components/agenda-item-card.tsx`

**Không đụng**:
- API code, types, hooks, business logic
- `apps/api/*`
- `lib/api-client.ts`, `lib/format.ts`
- `features/<x>/api.ts`

## Acceptance criteria

1. Mọi page load đúng tại 375px width, không có horizontal scroll
2. Sidebar drawer mở/đóng được trên mobile; click NAV item đóng drawer
3. Chat session drawer mở/đóng trên mobile
4. Modal (edit transaction, change password, important date form) sử dụng được trên mobile (button không bị che, input đủ to)
5. Charts (reports) responsive theo width container
6. Desktop ≥ 1024px: UX không thay đổi so với hiện tại
7. `pnpm --filter web lint` pass
8. `pnpm --filter web build` pass
