# Concord Web Responsive Design — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire Concord web app (`apps/web`) responsive mobile-first ≥360px without changing any business logic, API call, or desktop UX at ≥1024px.

**Architecture:** Approach A — Tailwind responsive in-place. Add 1 new component (`MobileDrawer`) reusable for sidebar + chat session list. Refactor `app/(authed)/layout.tsx` so sidebar becomes a drawer below `lg` (1024px). Each page gets Tailwind breakpoint classes; no business logic touched.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Recharts · TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-08-responsive-web-design.md](../specs/2026-05-08-responsive-web-design.md)

---

## File structure

**New (1 file):**
- `apps/web/components/ui/mobile-drawer.tsx` — Generic overlay drawer (portal, backdrop, esc/click-outside close, slide transition, body scroll lock). Used by sidebar + chat session list.

**Modified (~16 files):**

Layout chrome:
- `apps/web/app/(authed)/layout.tsx` — split into 2 branches (`< lg` flex column with drawer, `≥ lg` grid as before)
- `apps/web/components/layout/header.tsx` — add `onMenuClick` prop + hamburger button + responsive avatar block
- `apps/web/components/layout/sidebar.tsx` — add `onNavigate` prop, NAV `<Link>` calls it on click
- `apps/web/components/ui/index.tsx` — export `MobileDrawer` and update `PageHeader` padding to be responsive

Pages:
- `apps/web/app/login/page.tsx`
- `apps/web/app/(authed)/dashboard/page.tsx`
- `apps/web/app/(authed)/transactions/page.tsx`
- `apps/web/app/(authed)/reports/page.tsx`
- `apps/web/app/(authed)/goals/page.tsx`
- `apps/web/app/(authed)/important-dates/page.tsx`
- `apps/web/app/(authed)/important-dates/year/page.tsx`
- `apps/web/app/(authed)/settings/page.tsx`
- `apps/web/app/(authed)/chat/page.tsx`

Feature components:
- `apps/web/features/transactions/components/edit-transaction-modal.tsx`
- `apps/web/features/transactions/components/day-group.tsx`
- `apps/web/features/transactions/components/month-switcher.tsx`
- `apps/web/features/important-dates/components/agenda-item-card.tsx`
- `apps/web/features/important-dates/components/important-date-form-modal.tsx`
- `apps/web/features/auth/components/change-password-modal.tsx`

**NOT touched:**
- `apps/api/**`
- `lib/api-client.ts`, `lib/format.ts`
- `features/**/api.ts`, `features/**/types.ts`, `features/**/hooks.ts`

---

## Verification approach

This is a UI-refactor plan. Concord has no automated visual regression test infra (per spec). For each task that changes UI:

1. **Lint check**: `pnpm --filter web lint` must pass after each file change
2. **Type check**: `pnpm --filter web build` (or `tsc --noEmit`) at task end if changes are non-trivial
3. **Manual visual check**: dev server `pnpm --filter web dev`, open in Chrome DevTools device toolbar:
   - **Mobile**: iPhone SE (375 × 667)
   - **Tablet**: iPad Mini (768 × 1024)
   - **Desktop**: 1280 × 800
   Check the specific page/component changed. Look for: no horizontal scroll, no overlap, tap targets ≥ 44px, drawer opens/closes correctly.

The plan keeps the dev server (`pnpm --filter web dev`) running across tasks — start it once at Task 0, leave it running.

---

## Task 0: Setup — start dev server, verify baseline

**Files:** none (read-only)

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: clean working tree on `main`.

- [ ] **Step 2: Verify lint + build pass on baseline**

```bash
pnpm --filter web lint
pnpm --filter web build
```

Expected: both pass without errors. If they don't pass on baseline, stop and fix before doing anything else.

- [ ] **Step 3: Start dev server in background**

```bash
pnpm --filter web dev
```

Leave running for the rest of the plan. Visit http://localhost:3000 and confirm the dashboard loads (after login). Note baseline at 1280px width — this is the desktop reference; nothing should regress at this width.

- [ ] **Step 4: Open Chrome DevTools device toolbar**

Open http://localhost:3000 → DevTools (F12) → device toolbar (Ctrl+Shift+M). Set to "iPhone SE" (375 × 667). Confirm the desktop-only baseline is broken (sidebar overflows or layout horizontal-scrolls). This is what we're fixing.

---

## Task 1: Create `MobileDrawer` component

**Files:**
- Create: `apps/web/components/ui/mobile-drawer.tsx`
- Modify: `apps/web/components/ui/index.tsx`

- [ ] **Step 1: Write the new file**

Write `apps/web/components/ui/mobile-drawer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  widthClass?: string;
  children: React.ReactNode;
}

export function MobileDrawer({
  open,
  onClose,
  side = 'left',
  widthClass = 'w-[280px]',
  children,
}: MobileDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => {
      cancelAnimationFrame(id);
      setAnimateIn(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const sideClass = side === 'left' ? 'left-0' : 'right-0';
  const closedTranslate =
    side === 'left' ? '-translate-x-full' : 'translate-x-full';

  return createPortal(
    <div className="lg:hidden">
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          animateIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 ${sideClass} ${widthClass} z-50 overflow-y-auto bg-white shadow-xl transition-transform duration-200 ${
          animateIn ? 'translate-x-0' : closedTranslate
        }`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Export from index**

Open `apps/web/components/ui/index.tsx`. At the bottom, after the last export, add:

```tsx
export { MobileDrawer } from './mobile-drawer';
```

- [ ] **Step 3: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 4: Type check (build)**

```bash
pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/mobile-drawer.tsx apps/web/components/ui/index.tsx
git commit -m "feat(web): add MobileDrawer overlay component for mobile nav"
```

---

## Task 2: Update Header — hamburger + responsive user dropdown

**Files:**
- Modify: `apps/web/components/layout/header.tsx`

- [ ] **Step 1: Add `onMenuClick` prop and hamburger button**

In `apps/web/components/layout/header.tsx`:

Change the props signature from:

```tsx
export function Header({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
```

to:

```tsx
export function Header({
  user,
  onLogout,
  onMenuClick,
}: {
  user: AuthUser;
  onLogout: () => void;
  onMenuClick?: () => void;
}) {
```

- [ ] **Step 2: Adjust header padding + add hamburger**

Change the outer `<header>` className from:

```tsx
className="col-span-2 flex items-center justify-between border-b border-stone-200 bg-white/80 px-6 backdrop-blur"
```

to:

```tsx
className="flex h-16 items-center justify-between border-b border-stone-200 bg-white/80 px-3 backdrop-blur sm:px-4 lg:col-span-2 lg:px-6"
```

Then inside the first `<div className="flex items-center gap-3">` (the logo block), insert a hamburger button as the first child (before the logo div):

```tsx
{onMenuClick && (
  <button
    type="button"
    onClick={onMenuClick}
    className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 lg:hidden"
    aria-label="Mở menu"
  >
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  </button>
)}
```

- [ ] **Step 3: Make user dropdown trigger responsive**

Inside the user dropdown `<button>`, the `<div className="text-left leading-tight">` block currently always shows name + role+email. Replace it with:

```tsx
<div className="hidden text-left leading-tight sm:block">
  <div className="text-sm font-medium text-stone-800">
    {user.name}
  </div>
  <div className="text-[11px] text-stone-500">
    {user.role === 'husband' ? 'Chồng' : 'Vợ'} · {user.email}
  </div>
</div>
```

Mobile (< sm) shows avatar + chevron only.

- [ ] **Step 4: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/header.tsx
git commit -m "feat(web): responsive header with hamburger and compact user block"
```

---

## Task 3: Update Sidebar — add `onNavigate` prop

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Add prop and call on NAV click**

Change the signature from:

```tsx
export function Sidebar({ funds }: { funds: FundView[] }) {
```

to:

```tsx
export function Sidebar({
  funds,
  onNavigate,
}: {
  funds: FundView[];
  onNavigate?: () => void;
}) {
```

In the `NAV.map` block, add `onClick` to the `<Link>`:

```tsx
<Link
  key={n.href}
  href={n.href}
  onClick={() => onNavigate?.()}
  className={...}
>
```

- [ ] **Step 2: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): sidebar accepts onNavigate to support drawer close"
```

---

## Task 4: Refactor `(authed)/layout.tsx` — drawer + responsive shell

**Files:**
- Modify: `apps/web/app/(authed)/layout.tsx`

- [ ] **Step 1: Add drawer state + import**

In `apps/web/app/(authed)/layout.tsx`:

Add to the imports at top (alongside existing imports):

```tsx
import { MobileDrawer } from '@/components/ui';
```

Inside `AuthedLayout` function body, after the existing `useState` for funds, add:

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 2: Replace the JSX return**

Replace the existing return block (the whole `<LayoutContext.Provider>...` JSX) with:

```tsx
return (
  <LayoutContext.Provider value={{ user: auth.user, funds, reloadFunds }}>
    <div className="flex h-screen flex-col lg:hidden">
      <Header
        user={auth.user}
        onLogout={() => logout(router)}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="min-h-0 flex-1 overflow-hidden bg-stone-50">
        {children}
      </main>
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Sidebar funds={funds} onNavigate={() => setDrawerOpen(false)} />
      </MobileDrawer>
    </div>

    <div className="hidden h-screen grid-cols-[280px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)] lg:grid">
      <Header user={auth.user} onLogout={() => logout(router)} />
      <Sidebar funds={funds} />
      <main className="min-h-0 overflow-hidden bg-stone-50">{children}</main>
    </div>
  </LayoutContext.Provider>
);
```

- [ ] **Step 3: Lint + build**

```bash
pnpm --filter web lint
pnpm --filter web build
```

Expected: both PASS.

- [ ] **Step 4: Manual visual check**

In dev server (already running):
- **Desktop 1280px**: layout looks identical to baseline (sidebar fixed left, header top, main right). No regression.
- **Mobile 375px**: header full width with ☰ button at left, no sidebar visible. Click ☰ → drawer slides in from left with NAV + fund cards. Click backdrop → drawer closes. Click a NAV link → page changes AND drawer closes.
- Press Esc while drawer open → closes.

If any of these fail, debug before continuing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(authed\)/layout.tsx
git commit -m "feat(web): responsive authed layout with drawer below lg"
```

---

## Task 5: Login page — responsive form padding

**Files:**
- Modify: `apps/web/app/login/page.tsx`

- [ ] **Step 1: Read the file to identify the outer wrapper**

```bash
sed -n '1,50p' apps/web/app/login/page.tsx
```

Identify the outermost layout container. Typically it's a `<div className="flex min-h-screen items-center justify-center bg-...">` wrapping a form `<div>` or `<form>`.

- [ ] **Step 2: Apply responsive padding**

On the outermost container, ensure it has horizontal padding so the card doesn't touch the edge on mobile. Add (or merge into existing classes): `px-4`. Example — change the outer wrapper className to include `px-4`:

```tsx
<div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
```

On the inner card/form container (the bounded element with `max-w-...`), confirm it has a sensible mobile width:

```tsx
className="w-full max-w-sm ..."
```

If the card has fixed `w-96` or similar, change to `w-full max-w-sm`.

- [ ] **Step 3: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 4: Manual check at 375px**

- Login page at 375px: card has 16px gutter from edges, no horizontal scroll
- Email + password input full-width inside card
- Button full-width (or sensible)
- Desktop 1280px: unchanged

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/login/page.tsx
git commit -m "feat(web): responsive login form padding"
```

---

## Task 6: Dashboard page — fix sub-stat grid + recent transactions

**Files:**
- Modify: `apps/web/app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Fix `grid-cols-3` sub-stat that breaks at 360px**

Around line 214 there is `<div className="mt-4 grid grid-cols-3 gap-4 border-t border-stone-100 pt-4">`. Change to:

```tsx
<div className="mt-4 grid grid-cols-1 gap-4 border-t border-stone-100 pt-4 sm:grid-cols-3">
```

- [ ] **Step 2: Adjust main content padding**

In the main wrapper near line 97 — currently `<div className="flex-1 overflow-y-auto px-6 py-6">`. Change to:

```tsx
<div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
```

- [ ] **Step 3: Make recent-transaction action icons always visible compact on mobile**

Around line 513, find `className="invisible flex items-center gap-1 group-hover:visible"`. Replace with:

```tsx
className="flex items-center gap-1 sm:invisible sm:group-hover:visible"
```

This keeps action icons visible on touch devices (mobile/tablet) where there is no hover, and falls back to the hover-reveal pattern on desktop.

- [ ] **Step 4: Stat card font scaling (optional touch)**

Locate `text-2xl` or similar inside StatCard usage on dashboard. If StatCard's number uses `text-2xl`, leave alone. We won't change `components/ui/index.tsx` for this task — handled later if needed.

- [ ] **Step 5: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 6: Manual check at 375px**

- Dashboard at 375px: stat cards stack 1 column, no horizontal scroll
- Sub-stat row inside fund/goal card: stacks 1 column on mobile, 3 columns from sm
- Recent transactions: each row visible with action icons, no overlap, money number doesn't wrap badly

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(authed\)/dashboard/page.tsx
git commit -m "feat(web): responsive dashboard grid and action visibility"
```

---

## Task 7: PageHeader — responsive padding

**Files:**
- Modify: `apps/web/components/ui/index.tsx`

- [ ] **Step 1: Update `PageHeader` padding**

In `apps/web/components/ui/index.tsx`, the `PageHeader` function returns a `<div>` with `className="flex items-start justify-between border-b border-stone-200 bg-white px-6 py-4"`. Change to:

```tsx
className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-6"
```

`flex-wrap` lets the actions slot drop to the next line on tight mobile widths.

- [ ] **Step 2: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 3: Manual check**

Visit several pages (dashboard, transactions, goals) at 375px and 1280px. Header bar should not overflow at 375px. At 1280px, header looks identical (px-6 wins on lg).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/index.tsx
git commit -m "feat(web): responsive PageHeader padding"
```

---

## Task 8: Transactions page — collapsible filter toolbar

**Files:**
- Modify: `apps/web/app/(authed)/transactions/page.tsx`

- [ ] **Step 1: Add filter-open state**

In `apps/web/app/(authed)/transactions/page.tsx`, after the existing `useState` block, add:

```tsx
const [filterOpen, setFilterOpen] = useState(false);
```

- [ ] **Step 2: Find the toolbar block**

The toolbar contains: search input, fund filter tabs (`<FundFilterTabs />`), and the month switcher (`<MonthSwitcher />`). It's typically wrapped in a flex/grid container in the JSX.

Wrap the search input + fund filter tabs in a `<div>` that conditionally renders on mobile when `filterOpen` is true (or always renders on `sm:` and above). Add a "Bộ lọc" button that toggles `filterOpen` on mobile.

Example replacement of the current toolbar block:

```tsx
<div className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6">
  <div className="flex items-center gap-2">
    <MonthSwitcher
      year={year}
      month={month}
      onShift={shiftMonth}
    />
    <button
      type="button"
      onClick={() => setFilterOpen((v) => !v)}
      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 sm:hidden"
      aria-expanded={filterOpen}
    >
      <span>Bộ lọc</span>
      <svg
        className={`h-4 w-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  <div
    className={`flex flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:gap-3 ${
      filterOpen ? 'flex' : 'hidden'
    }`}
  >
    <input
      type="search"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Tìm giao dịch..."
      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm sm:w-64"
    />
    <FundFilterTabs
      funds={funds}
      value={fundFilter}
      onChange={changeFundFilter}
    />
  </div>
</div>
```

Match the actual prop names of `MonthSwitcher` and `FundFilterTabs` — read the existing code to confirm before applying. Keep the same prop wiring (state vars `year`, `month`, `fundFilter`, `search`, etc.).

- [ ] **Step 3: Adjust pagination tap targets**

Search for the `<Pagination />` component usage on this page. The component is in `features/transactions/components/pagination.tsx` (handled in Task 9). Skip here.

- [ ] **Step 4: Lint + build**

```bash
pnpm --filter web lint
pnpm --filter web build
```

Expected: both PASS.

- [ ] **Step 5: Manual check at 375px**

- Toolbar shows month switcher + "Bộ lọc" button only
- Click "Bộ lọc" → search + fund tabs slide down (display change)
- Click again → collapse
- At ≥640px (sm), search + fund tabs always visible, "Bộ lọc" button hidden
- Day groups list below, no horizontal scroll
- Desktop 1280px: looks identical to baseline (search + tabs visible, no "Bộ lọc" button)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(authed\)/transactions/page.tsx
git commit -m "feat(web): responsive transactions toolbar with filter collapse"
```

---

## Task 9: Transaction sub-components — day-group, month-switcher, pagination, edit-modal

**Files:**
- Modify: `apps/web/features/transactions/components/day-group.tsx`
- Modify: `apps/web/features/transactions/components/month-switcher.tsx`
- Modify: `apps/web/features/transactions/components/pagination.tsx`
- Modify: `apps/web/features/transactions/components/edit-transaction-modal.tsx`

- [ ] **Step 1: `day-group.tsx` — shrink padding, allow money wrap**

Open `apps/web/features/transactions/components/day-group.tsx`. Find the outer wrapper `<div>` for the day group (likely `className="rounded-lg ... p-4"` or similar). Change `p-4` → `p-3 sm:p-4`.

For the row inside the day group (each transaction line), find the `<div>` that contains the description on the left and amount on the right. If it uses `flex` with no wrap, leave as-is but ensure amount has `whitespace-nowrap` and description has `min-w-0 flex-1 truncate`. Concretely: locate the row container and confirm/adjust to:

```tsx
<div className="flex items-center justify-between gap-2 ...">
  <div className="min-w-0 flex-1">{/* description, category */}</div>
  <div className="whitespace-nowrap font-mono tabular-nums">{/* amount */}</div>
</div>
```

If `min-w-0 flex-1 truncate` is not present on the description block, add it.

- [ ] **Step 2: `month-switcher.tsx` — compact mobile**

Open `apps/web/features/transactions/components/month-switcher.tsx`. Identify the wrapper that displays "Tháng N · YYYY" plus prev/next buttons. Reduce padding/font on mobile. Example change for the wrapper:

```tsx
className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm sm:px-3 sm:py-1.5"
```

For the prev/next buttons, ensure tap target ≥ 36px on mobile:

```tsx
className="flex h-8 w-8 items-center justify-center rounded text-stone-700 hover:bg-stone-100"
```

- [ ] **Step 3: `pagination.tsx` — tap targets**

Open `apps/web/features/transactions/components/pagination.tsx`. Find the prev/next buttons. Ensure they have `min-h-[44px]` (or use `py-2.5`) and `px-4` for adequate tap target:

```tsx
className="inline-flex min-h-[44px] items-center rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-50"
```

If the page indicator (e.g. "Trang 1 / 3") is in the same row, ensure it has `flex flex-wrap items-center justify-between gap-2` on the parent so it stacks gracefully on narrow widths.

- [ ] **Step 4: `edit-transaction-modal.tsx` — modal padding + button stack**

Open `apps/web/features/transactions/components/edit-transaction-modal.tsx`. Find the modal panel's outer div. Adjust:

- Padding: `p-4 sm:p-6`
- Width: `w-full max-w-md mx-auto` (with `mx-4` on the panel, or wrap with backdrop padding `p-4`)
- Action buttons row at the bottom: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`. The destructive Delete stays first in DOM (so `flex-col-reverse` puts it visually below Save on mobile, and to the left on desktop).

Example for the buttons block:

```tsx
<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
  <button type="button" onClick={onDelete} className="...">Xoá</button>
  <button type="button" onClick={onClose} className="...">Huỷ</button>
  <button type="submit" className="...">Lưu</button>
</div>
```

Keep the existing button styling/handlers — only change the wrapper.

- [ ] **Step 5: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 6: Manual check at 375px**

- Day group cards: padding looks right, amounts don't push description off
- Month switcher: compact, doesn't overflow
- Pagination: prev/next buttons easy to tap
- Open edit modal on a transaction: form fits, all inputs reachable, buttons visible without scroll (or scroll works), buttons stack vertically with Save at top
- Desktop 1280px: looks identical

- [ ] **Step 7: Commit**

```bash
git add apps/web/features/transactions/components/
git commit -m "feat(web): responsive transaction subcomponents (day-group, switcher, pagination, modal)"
```

---

## Task 10: Reports page — responsive charts + tabs

**Files:**
- Modify: `apps/web/app/(authed)/reports/page.tsx`

- [ ] **Step 1: Inspect chart usage**

```bash
grep -n "ResponsiveContainer\|<BarChart\|<LineChart\|<PieChart\|height=" apps/web/app/\(authed\)/reports/page.tsx
```

Note the chart wrappers — most likely already use `<ResponsiveContainer width="100%" height={N}>`. The fix is to make `height` smaller on mobile.

- [ ] **Step 2: Adjust chart height with two containers**

Wherever there is a chart, replace the single ResponsiveContainer with two — one mobile, one desktop. Pattern:

```tsx
<>
  <div className="lg:hidden">
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>...</BarChart>
    </ResponsiveContainer>
  </div>
  <div className="hidden lg:block">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>...</BarChart>
    </ResponsiveContainer>
  </div>
</>
```

Apply the same wrap to all charts on the page (typically 2-3 charts).

If duplicating the entire `<BarChart>` config feels too verbose, an alternative: `<ResponsiveContainer width="100%" height={300} className="!h-[240px] lg:!h-[300px]">` — but Recharts ignores className for height (it uses the prop). Stick with the two-container pattern.

- [ ] **Step 3: Tab switcher overflow-x**

Find the tab switcher (joint/personal/Mạnh/Wife). The container is likely `<div className="flex gap-2 ...">`. Wrap it in a horizontal-scroll container:

```tsx
<div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
  <div className="flex gap-2 ...">
    {/* existing tab buttons */}
  </div>
</div>
```

The negative margin lets it bleed to the edge on mobile so users see scroll affordance.

- [ ] **Step 4: Page wrapper padding**

Locate the main content wrapper of reports. Adjust to `px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6` like dashboard.

- [ ] **Step 5: Lint + build**

```bash
pnpm --filter web lint
pnpm --filter web build
```

Expected: both PASS.

- [ ] **Step 6: Manual check at 375px**

- Charts visible, fit within width, height ~240px
- Tab switcher: scrollable horizontally if tabs overflow
- Legend readable, no overlap
- Desktop 1280px: charts at 300px height, tabs in normal row, identical to baseline

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(authed\)/reports/page.tsx
git commit -m "feat(web): responsive reports page with mobile chart sizes"
```

---

## Task 11: Goals page — responsive grid + form

**Files:**
- Modify: `apps/web/app/(authed)/goals/page.tsx`

- [ ] **Step 1: Adjust main wrapper padding**

Find the main scrollable wrapper. Set `px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6`.

- [ ] **Step 2: Goal cards grid**

Find the grid that lays out goal cards. If it's `grid-cols-2` or similar, change to `grid-cols-1 lg:grid-cols-2` (or `md:grid-cols-2` if you prefer 2 cols starting at tablet).

- [ ] **Step 3: Form add/edit goal — inputs stack**

If the goal form has a row like `<div className="grid grid-cols-2 gap-3">` for two-column input layout, change to `grid-cols-1 sm:grid-cols-2`.

For the action button row (Save/Cancel), wrap in:

```tsx
<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
```

- [ ] **Step 4: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 5: Manual check at 375px**

- Goal cards stack 1 column
- Form inputs full-width, button row stacks vertically
- Desktop 1280px: 2-col grid restored

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(authed\)/goals/page.tsx
git commit -m "feat(web): responsive goals page grid and form"
```

---

## Task 12: Important-dates pages

**Files:**
- Modify: `apps/web/app/(authed)/important-dates/page.tsx`
- Modify: `apps/web/app/(authed)/important-dates/year/page.tsx`
- Modify: `apps/web/features/important-dates/components/agenda-item-card.tsx`
- Modify: `apps/web/features/important-dates/components/important-date-form-modal.tsx`

- [ ] **Step 1: List page — main padding**

In `apps/web/app/(authed)/important-dates/page.tsx`, set main wrapper padding `px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6`.

- [ ] **Step 2: `agenda-item-card.tsx` — shrink + hide secondary meta**

Open `apps/web/features/important-dates/components/agenda-item-card.tsx`. The card layout typically has title + date + reminders + maybe note. Apply:

- Outer card padding: `p-3 sm:p-4`
- For tertiary text (note, "Tạo bởi...", lead time meta): wrap with `<span className="hidden sm:inline">...</span>` or `<div className="hidden sm:block">...</div>` so the dense list reads cleanly on mobile

Identify which fields are non-essential (e.g. "Tạo lúc HH:mm" timestamp, footer meta) and hide them on `< sm`. Title + date + reminder count must remain visible.

- [ ] **Step 3: `important-date-form-modal.tsx` — modal responsive**

Open `apps/web/features/important-dates/components/important-date-form-modal.tsx`. Apply same pattern as edit-transaction-modal:

- Backdrop padding: `p-4`
- Panel: `w-full max-w-md`, panel padding `p-4 sm:p-6`
- Button row at bottom: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3`

- [ ] **Step 4: Year page — calendar grid responsive**

Open `apps/web/app/(authed)/important-dates/year/page.tsx`. Find the 12-month grid. If it's `grid-cols-3` or `grid-cols-4`, change to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.

Each month cell: ensure padding shrinks on mobile (`p-2 sm:p-3`), day cells have minimum tap target (`min-h-8`).

- [ ] **Step 5: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 6: Manual check at 375px**

- Important-dates list: cards stack, key info visible, secondary meta hidden
- Year page: months stack 1 column on mobile, no horizontal scroll
- Form modal opens, fits, buttons reachable
- Desktop 1280px: 4-col year grid restored

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(authed\)/important-dates/ apps/web/features/important-dates/components/
git commit -m "feat(web): responsive important-dates pages and form modal"
```

---

## Task 13: Settings page

**Files:**
- Modify: `apps/web/app/(authed)/settings/page.tsx`
- Modify: `apps/web/features/auth/components/change-password-modal.tsx`

- [ ] **Step 1: Settings page main padding + form sections**

In `apps/web/app/(authed)/settings/page.tsx`, set main wrapper padding `px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6`.

For each form section (e.g. profile, salary rule, notifications), if it uses a grid `grid-cols-2` for label + input layout, change to `grid-cols-1 sm:grid-cols-2`. If labels are in a separate column, switch to label-above-input on mobile by stacking.

For action button rows: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3`.

- [ ] **Step 2: `change-password-modal.tsx` — same modal pattern**

Apply the same as edit-transaction-modal:

- Backdrop padding: `p-4`
- Panel: `w-full max-w-md`, padding `p-4 sm:p-6`
- Button row: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3`

- [ ] **Step 3: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 4: Manual check at 375px**

- Settings sections stack, inputs full-width
- Open change-password modal: fits, all 3 inputs visible without scroll on iPhone SE
- Desktop 1280px: unchanged

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(authed\)/settings/page.tsx apps/web/features/auth/components/change-password-modal.tsx
git commit -m "feat(web): responsive settings and change-password modal"
```

---

## Task 14: Chat page — session drawer + composer + bubbles

**Files:**
- Modify: `apps/web/app/(authed)/chat/page.tsx`

This is the largest page. Take the steps in order; do not skip ahead.

- [ ] **Step 1: Add session drawer state**

In `apps/web/app/(authed)/chat/page.tsx`, near the other `useState` calls, add:

```tsx
const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
```

Add `MobileDrawer` to the existing `@/components/ui` import:

```tsx
import { /* existing names, */ MobileDrawer } from '@/components/ui';
```

- [ ] **Step 2: Identify the existing layout structure**

The chat page has a 2-pane layout: left = session list, right = messages + composer. The container is likely `<div className="grid h-full grid-cols-[260px_1fr]">` or similar. Read the JSX to confirm.

- [ ] **Step 3: Replace the layout container**

Change from a fixed 2-column grid to: a single column on mobile (chat area only) + 2-column grid on `lg`. The session list section becomes a child rendered both inline (lg) and inside drawer (mobile).

Find the outer chat layout and replace with this structure (adapt to current variable names — `sessions`, `currentSessionId`, `selectSession`, `handleNewSession`, etc.):

```tsx
<div className="flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[260px_1fr]">
  <aside className="hidden border-r border-stone-200 bg-white lg:block">
    {/* existing session list JSX */}
  </aside>

  <section className="flex min-h-0 flex-1 flex-col">
    {/* existing chat header / messages / composer */}
  </section>

  <MobileDrawer
    open={sessionDrawerOpen}
    onClose={() => setSessionDrawerOpen(false)}
    widthClass="w-[280px]"
  >
    <div className="flex h-full flex-col">
      {/* same session list JSX as above, but NAV item click should also close drawer */}
    </div>
  </MobileDrawer>
</div>
```

To avoid duplicating the session list JSX, extract it into a local `function SessionList({ onPick }: { onPick?: () => void }) { ... }` defined inside the same file (not a new file). Pass `onPick` so the drawer version can call `setSessionDrawerOpen(false)` on session select. Inline `<aside>` calls `<SessionList />` without `onPick`; drawer calls `<SessionList onPick={() => setSessionDrawerOpen(false)} />`.

In `SessionList`, when a user clicks a session row (which calls `selectSession(s.id)` or similar), also call `onPick?.()` after.

- [ ] **Step 4: Chat header — add "Lịch sử" button on mobile**

In the chat `<section>`, the header bar (where session title + actions live) — add a "Lịch sử" button that's `lg:hidden`:

```tsx
<button
  type="button"
  onClick={() => setSessionDrawerOpen(true)}
  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 lg:hidden"
>
  <span>Lịch sử</span>
</button>
```

Place it before existing actions (e.g. "Xoá session"). Hide long meta text (e.g. token usage, model name) on mobile with `hidden sm:inline`.

- [ ] **Step 5: Message bubbles — wider on mobile**

Search for `max-w-[70%]` or similar on the message bubble div. Change to `max-w-[85%] lg:max-w-[70%]`.

- [ ] **Step 6: Suggestion chips — horizontal scroll**

Find the suggestion chips block. Wrap in:

```tsx
<div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
  <div className="flex gap-2 whitespace-nowrap">
    {/* existing chip buttons */}
  </div>
</div>
```

- [ ] **Step 7: Composer — fix to bottom + safe area**

Locate the composer div (input + send button). Ensure its container has:

```tsx
className="border-t border-stone-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 lg:px-6"
```

The send button on mobile (< sm) should be icon-only:

```tsx
<button type="submit" className="flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-white sm:px-4">
  <span className="hidden sm:inline">Gửi</span>
  <svg className="h-5 w-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 5l7 7-7 7" />
  </svg>
</button>
```

Use the existing handler for send.

- [ ] **Step 8: Messages container padding**

The scrolling messages container: `px-3 sm:px-4 lg:px-6`.

- [ ] **Step 9: Lint + build**

```bash
pnpm --filter web lint
pnpm --filter web build
```

Expected: both PASS.

- [ ] **Step 10: Manual check at 375px**

- Chat page mobile: only chat area visible, header has "Lịch sử" button
- Click "Lịch sử" → drawer opens with session list
- Click a session in drawer → selects session AND closes drawer
- Click backdrop → drawer closes
- Send a message → bubble renders at ≤85% width, no horizontal scroll
- Composer pinned at bottom; on iPhone SE simulator the input is reachable above the keyboard area
- Suggestion chips scroll horizontally
- Desktop 1280px: 2-column layout restored, no "Lịch sử" button

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/\(authed\)/chat/page.tsx
git commit -m "feat(web): responsive chat with session drawer and mobile composer"
```

---

## Task 15: Final smoke test + lint + build

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

```bash
pnpm --filter web lint
```

Expected: PASS, no warnings other than pre-existing.

- [ ] **Step 2: Run build**

```bash
pnpm --filter web build
```

Expected: PASS, type-check clean.

- [ ] **Step 3: Smoke test at 375 × 667 (iPhone SE)**

In Chrome DevTools device toolbar set to iPhone SE, log in and verify each page:

- `/dashboard` — stat cards stack 1 column, no horizontal scroll, drawer ☰ works
- `/chat` — chat area visible, "Lịch sử" opens session drawer, send works
- `/transactions` — month switcher + "Bộ lọc" toggle, day groups list, edit modal works
- `/reports` — charts render at ~240px height, tab scroll works
- `/goals` — cards stack, add goal form works
- `/important-dates` — agenda list compact, form modal works
- `/important-dates/year` — 12 months stacked
- `/settings` — form sections stack, change-password modal works

For each page, check: no horizontal scroll, all tap targets reachable, drawer opens/closes correctly.

- [ ] **Step 4: Smoke test at 768 × 1024 (iPad Mini)**

Repeat above. Drawer still in use (cutoff is `lg` = 1024). Layout should be more spacious than 375px but still single-pane main content.

- [ ] **Step 5: Smoke test at 1280 × 800 (desktop)**

Repeat above. Layout should be **identical** to pre-refactor baseline:
- Sidebar fixed 280px on left, always visible
- No hamburger button
- Chat 2-column with session list inline
- Reports charts at 300px height
- All grids in their original column counts

If anything regressed, debug before declaring complete.

- [ ] **Step 6: Final commit (optional — nothing to commit if everything else committed)**

```bash
git status
```

Expected: clean. If there are leftover changes from manual fixes during smoke test, commit them as `fix(web): responsive smoke-test polish`.

- [ ] **Step 7: Stop dev server**

Stop the background `pnpm --filter web dev` process.

---

## Acceptance criteria recap

1. Mọi page load đúng tại 375px width, không có horizontal scroll
2. Sidebar drawer mở/đóng được trên mobile; click NAV item đóng drawer
3. Chat session drawer mở/đóng trên mobile
4. Modal (edit transaction, change password, important date form) sử dụng được trên mobile
5. Charts (reports) responsive theo width container
6. Desktop ≥ 1024px: UX không thay đổi so với hiện tại
7. `pnpm --filter web lint` pass
8. `pnpm --filter web build` pass
