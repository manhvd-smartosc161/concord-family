# Dark Mode cho Concord Web — Design Spec

**Date**: 2026-05-14
**Scope**: `apps/web` (NextJS 16 + Tailwind v4)
**Rollout**: Big bang — toàn bộ web app trong 1 spec

---

## 1. Mục tiêu

Thêm dark mode cho toàn bộ Concord web app, với 3 chế độ user-selectable: **Sáng / Tối / Hệ thống** (default = Hệ thống). Toggle nằm ở header (top-right), persist qua localStorage, không flash-of-wrong-theme khi reload.

Đồng thời migrate codebase từ raw Tailwind color classes (`bg-stone-50`, `text-stone-900`, ...) sang **semantic token system** (`bg-background`, `text-foreground`, ...) — align với hướng shadcn/ui đã planned trong CLAUDE.md.

## 2. Non-goals

- Không setup shadcn/ui CLI trong spec này (có thể làm sau, tokens compatible).
- Không automated visual regression testing — manual QA đủ.
- Không refactor component structure ngoài color classes.
- Không touch backend (API trả data agnostic với theme).

## 3. Architecture

### 3.1 Color token system

Define CSS variables trong `apps/web/app/globals.css`, expose qua Tailwind v4 `@theme inline` block:

```css
:root {
  --background: oklch(0.99 0.003 90);
  --foreground: oklch(0.21 0.01 90);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.01 90);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.01 90);
  --muted: oklch(0.96 0.005 90);
  --muted-foreground: oklch(0.45 0.01 90);
  --border: oklch(0.92 0.005 90);
  --input: oklch(0.92 0.005 90);
  --ring: oklch(0.45 0.15 250);
  --primary: oklch(0.45 0.15 250);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.96 0.005 90);
  --secondary-foreground: oklch(0.21 0.01 90);
  --accent: oklch(0.96 0.005 90);
  --accent-foreground: oklch(0.21 0.01 90);
  --destructive: oklch(0.55 0.20 25);
  --destructive-foreground: oklch(0.99 0 0);

  /* Chat visibility-mode tints */
  --chat-private-bg: oklch(0.98 0.01 280);
  --chat-public-bg: oklch(0.98 0.015 140);
}

.dark {
  --background: oklch(0.16 0.01 250);
  --foreground: oklch(0.95 0.005 90);
  --card: oklch(0.20 0.01 250);
  --card-foreground: oklch(0.95 0.005 90);
  --popover: oklch(0.20 0.01 250);
  --popover-foreground: oklch(0.95 0.005 90);
  --muted: oklch(0.24 0.01 250);
  --muted-foreground: oklch(0.65 0.01 90);
  --border: oklch(0.28 0.01 250);
  --input: oklch(0.28 0.01 250);
  --ring: oklch(0.65 0.18 250);
  --primary: oklch(0.65 0.18 250);
  --primary-foreground: oklch(0.16 0.01 250);
  --secondary: oklch(0.24 0.01 250);
  --secondary-foreground: oklch(0.95 0.005 90);
  --accent: oklch(0.24 0.01 250);
  --accent-foreground: oklch(0.95 0.005 90);
  --destructive: oklch(0.60 0.22 25);
  --destructive-foreground: oklch(0.99 0 0);

  --chat-private-bg: oklch(0.22 0.02 280);
  --chat-public-bg: oklch(0.22 0.02 140);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
}
```

Color values dùng `oklch()` để perceptual uniformity. Dark palette tone xanh-trung tính (hue 250), không pure black để giảm eye strain.

### 3.2 Theme provider

Dùng `next-themes` (npm package, ~3KB, SSR-safe, handle FOUC). Cài vào `apps/web` workspace:

```bash
pnpm --filter web add next-themes
```

Wrap root layout (`app/layout.tsx`):

```tsx
import { ThemeProvider } from 'next-themes';

<html lang={locale} suppressHydrationWarning className="...">
  <body className="min-h-full bg-background font-sans text-foreground">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NextIntlClientProvider ...>{children}</NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

- `attribute="class"` → toggle `.dark` class trên `<html>`.
- `suppressHydrationWarning` cần thiết vì next-themes set class trước khi React hydrate.
- `defaultTheme="system"` + `enableSystem` → follow OS prefers-color-scheme khi user chưa chọn.

### 3.3 ThemeToggle component

New file: `apps/web/components/layout/theme-toggle.tsx`

```tsx
'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  // Dropdown: Sun (light) / Moon (dark) / Monitor (system)
  // Icon hiện tại dựa trên `theme`
  // Click → cycle hoặc mở dropdown chọn 3 option
  ...
}
```

Layout:
- Single icon button hiển thị icon hiện tại (Sun/Moon/Monitor theo `theme`).
- Click → mở dropdown menu 3 option với label tiếng Việt: **Sáng**, **Tối**, **Hệ thống**.
- Aria labels đầy đủ.

Mount vào:
- `components/layout/header.tsx` — desktop top-right
- `components/ui/mobile-drawer.tsx` — mobile drawer (top hoặc cạnh close button)

### 3.4 Color class migration

Áp dụng mapping rule **consistent** across tất cả file:

| Hiện tại (light-only) | Đổi thành (theme-aware) |
|---|---|
| `bg-stone-50` (page bg) | `bg-background` |
| `bg-white` (page bg) | `bg-background` |
| `bg-white` (card/surface) | `bg-card` |
| `text-stone-900`, `text-gray-900`, `text-black` | `text-foreground` |
| `text-stone-700`, `text-stone-600`, `text-gray-700`, `text-gray-600`, `text-gray-500` | `text-muted-foreground` |
| `border-stone-200`, `border-gray-200`, `border-gray-300` | `border-border` |
| `bg-stone-100`, `bg-gray-100`, `bg-gray-50` (muted surface) | `bg-muted` |
| brand blue/indigo button bg (`bg-blue-600`...) | `bg-primary` |
| brand button text trên primary | `text-primary-foreground` |
| `bg-red-50/100`, `text-red-600` (error states) | `bg-destructive/10`, `text-destructive` |
| input border, input bg | `border-input`, `bg-background` |
| focus ring (`ring-blue-*`) | `ring-ring` |

**Edge cases**:
- **Chat page** (`app/(authed)/chat/page.tsx`): tint theo visibility mode private/public — dùng custom CSS vars `--chat-private-bg`, `--chat-public-bg` (already defined in token block above). Áp dụng qua style attribute hoặc utility class custom.
- **Auth pages** brand panel (login, register redesigned recently): có thể giữ accent color đặc trưng nhưng wrap qua `bg-primary` / gradient with `--primary`.
- **Charts (Recharts)** trong `reports/page.tsx`: hardcoded colors → wrap qua helper `getChartColors()` đọc CSS vars (`getComputedStyle(document.documentElement).getPropertyValue('--foreground')`) hoặc dùng theme-aware palette object switch theo `useTheme()`.

### 3.5 Files cần thay đổi (full list)

**Foundation (new + modified)**:
- `apps/web/app/globals.css` — modified: thêm token block + `.dark` block + `@theme inline`
- `apps/web/app/layout.tsx` — modified: wrap ThemeProvider, đổi body classes
- `apps/web/components/layout/theme-toggle.tsx` — new
- `apps/web/package.json` — modified: thêm `next-themes` dep

**Layout/shared**:
- `apps/web/components/layout/header.tsx` — mount ThemeToggle + token migration
- `apps/web/components/layout/sidebar.tsx` — token migration
- `apps/web/components/ui/mobile-drawer.tsx` — mount ThemeToggle + token migration
- `apps/web/components/ui/index.tsx` — token migration (nếu có color classes)

**Auth pages** (5):
- `apps/web/app/login/page.tsx`
- `apps/web/app/register/page.tsx`
- `apps/web/app/forgot-password/page.tsx`
- `apps/web/app/reset-password/page.tsx`
- `apps/web/app/invite/[token]/page.tsx`

**Authed pages** (12):
- `apps/web/app/(authed)/layout.tsx`
- `apps/web/app/(authed)/chat/page.tsx` (+ custom chat tint handling)
- `apps/web/app/(authed)/transactions/page.tsx`
- `apps/web/app/(authed)/goals/page.tsx`
- `apps/web/app/(authed)/reports/page.tsx` (+ Recharts theme helper)
- `apps/web/app/(authed)/settings/page.tsx`
- `apps/web/app/(authed)/finance-settings/page.tsx`
- `apps/web/app/(authed)/family/setup/page.tsx`
- `apps/web/app/(authed)/family/invite/page.tsx`
- `apps/web/app/(authed)/important-dates/page.tsx`
- `apps/web/app/(authed)/important-dates/year/page.tsx`
- `apps/web/app/(authed)/important-dates/calendar/page.tsx`

Tổng: ~22 files modified, 1 file new.

## 4. Testing & QA

**Manual QA checklist** (chạy trên Chrome desktop + iOS Safari simulator):

Per-page (mỗi page trong list 4.5):
- [ ] Light mode: render đúng như trước refactor (regression check)
- [ ] Dark mode: text contrast đọc được, không có vùng trắng/đen pure
- [ ] Form inputs: border visible, placeholder readable, focus ring visible
- [ ] Buttons primary/destructive: contrast đủ
- [ ] Borders/dividers: visible nhưng không quá đậm
- [ ] Hover/active states: feedback rõ ràng

System-wide:
- [ ] Toggle 3 modes từ header → chuyển mượt, không flash
- [ ] Reload page với mode đã chọn → giữ nguyên, không FOUC
- [ ] Đổi OS theme (light/dark) khi mode = System → app tự follow
- [ ] Mở 2 tab → đổi mode tab 1 → tab 2 tự sync (next-themes default behavior)
- [ ] Chat visibility tint private/public còn hoạt động cả 2 mode
- [ ] Recharts trong `/reports`: axis/tooltip/grid readable dark mode

**Out of scope**: automated visual regression, Playwright e2e.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Miss color class ở 1 page → mixed appearance | Grep `bg-stone-\|bg-white\|bg-gray\|text-gray\|text-stone\|text-black\|border-stone\|border-gray` sau refactor, expect 0 hits ngoài chat-tint edge case |
| Recharts colors hardcoded → unreadable dark | Centralize chart palette trong helper, đọc CSS vars |
| FOUC khi reload | `next-themes` handle bằng inline script; verify by reload nhiều lần |
| Hydration mismatch warning | `suppressHydrationWarning` trên `<html>` + `mounted` guard trong ThemeToggle |
| Brand accent color (login/register redesign) bị "flat" ở dark | Tune `--primary` ở dark palette, manual check |

## 6. Implementation phasing (gợi ý cho plan)

Suggest split work theo phases khi viết implementation plan:

1. **Foundation**: globals.css tokens + ThemeProvider + ThemeToggle + mount vào header/mobile-drawer. End state: toggle hoạt động nhưng pages vẫn light-only.
2. **Shared chrome**: header, sidebar, mobile-drawer, (authed)/layout, app/layout — token migration.
3. **Auth pages**: login, register, forgot-password, reset-password, invite — token migration.
4. **Authed pages — simple**: settings, finance-settings, family/*, important-dates/* — straight token swap.
5. **Authed pages — complex**: transactions, goals, chat (visibility tint), reports (Recharts) — cần case-by-case.
6. **QA pass**: manual checklist toàn bộ + grep verification.

Mỗi phase commit riêng để dễ revert nếu cần.
