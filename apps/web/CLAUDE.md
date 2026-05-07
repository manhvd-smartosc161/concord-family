# `apps/web` — Concord NextJS UI

NextJS 16 (App Router) + React 19 + Tailwind v4 + Recharts. Đây là module-level
guide; quy ước chung xem `concord/CLAUDE.md`.

## Layout (feature-first)

```
apps/web/
├── app/                          THIN — chỉ routing + composition
│   ├── layout.tsx                root html shell
│   ├── globals.css               Tailwind v4 directive
│   ├── page.tsx                  redirect /dashboard hoặc /login
│   ├── login/page.tsx
│   └── (authed)/                 route group, mọi page sau login
│       ├── layout.tsx            auth gate + chrome compose (~70 dòng)
│       ├── chat/page.tsx
│       ├── dashboard/page.tsx
│       ├── transactions/page.tsx
│       ├── reports/page.tsx
│       ├── goals/page.tsx
│       └── settings/page.tsx
├── features/                     vertical slice mỗi domain
│   ├── auth/
│   │   ├── api.ts                login, me, changePassword
│   │   ├── hooks.ts              useAuth, logout
│   │   ├── types.ts              AuthUser, UserRole, LoginResponse
│   │   └── components/change-password-modal.tsx
│   ├── funds/
│   │   ├── api.ts, types.ts
│   │   └── components/{fund-card, fund-filter-tabs}.tsx
│   ├── transactions/
│   │   ├── api.ts, types.ts
│   │   ├── lib/group-by-day.ts
│   │   └── components/{edit-transaction-modal, day-group, month-switcher, pagination}.tsx
│   ├── chat/, goals/, reports/, categories/, settings/
│   │   └── (mỗi cái có api.ts, types.ts)
├── components/                   shared UI
│   ├── ui/index.tsx              Card, Badge, EmptyState, Skeleton, StatCard, PageHeader, ProgressBar
│   └── layout/{header, sidebar}.tsx
├── lib/
│   ├── api-client.ts             apiFetch + ApiError + token storage
│   └── format.ts                 formatVND
└── ...
```

Path alias: `@/*` → `./*` (root web/). Mọi import nội bộ dùng `@/features/...`,
`@/lib/...`, `@/components/...` thay vì relative.

## Auth model

- Token JWT lưu `localStorage` (key `concord_access_token`) — `lib/api-client.ts`.
- `features/auth/hooks.ts` exports `useAuth()` hook + `logout()`.
- Mọi protected page sống trong `(authed)/` group → `(authed)/layout.tsx` tự gate.
- KHÔNG có NextAuth (biến `NEXTAUTH_*` chỉ dùng cho CORS).

## Pattern khi thêm feature mới (vd "budgets")

1. **Tạo folder `features/budgets/`**:
   - `api.ts` — exported function gọi qua `apiFetch<T>` từ `@/lib/api-client`
   - `types.ts` — type mirror DTO của API
   - `components/<x>.tsx` — component riêng cho feature
   - `hooks.ts` (optional) — custom hook cho feature
2. **Tạo page** `app/(authed)/budgets/page.tsx`:
   - `'use client'`
   - Import từ `@/features/budgets/api` + `@/features/budgets/types`
   - Compose UI từ `@/components/ui` + `@/features/budgets/components/`
3. **Update sidebar** `components/layout/sidebar.tsx` (`const NAV = [...]`)
   nếu route xuất hiện trong menu chính.
4. KHÔNG gọi `fetch()` raw, KHÔNG đụng `localStorage` trực tiếp.

## Pattern page (App Router + (authed))

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthedLayout } from '../layout';
import { listFoo } from '@/features/foo/api';
import type { FooView } from '@/features/foo/types';
import { Card, PageHeader } from '@/components/ui';

export default function FoobarPage() {
  const { user } = useAuthedLayout();
  const [data, setData] = useState<FooView[]>([]);

  useEffect(() => {
    void listFoo().then(setData);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Foo" subtitle="..." />
      <main className="flex-1 overflow-y-auto px-6 py-6">...</main>
    </div>
  );
}
```

## Styling

- Tailwind v4 (dùng `@import "tailwindcss"` trong `globals.css`).
- Palette: `stone-*` neutral, `emerald-*` positive/owner, `amber-*` joint,
  `sky-*` envelope/mục tiêu, `rose-*` destructive.
- Number monospace: `font-mono tabular-nums`.
- VND format: `formatVND()` từ `@/lib/format`. KHÔNG tự `toLocaleString` ad-hoc.
- shadcn/ui: chưa setup. Đừng `npx shadcn add ...` mà không discuss trước.

## Fetcher pattern

Mọi call API qua `apiFetch<T>(path, init)` từ `@/lib/api-client` — tự inject
`Bearer` token, tự handle 401/204, throw `ApiError`. Wrap thêm trong
`features/<x>/api.ts` (typed function).

Public call (`login`) thêm `auth: false`.

## Anti-patterns thường gặp với Claude Code

- ❌ Tạo `app/<protected>/page.tsx` ngoài `(authed)/` — sẽ không được auth gate.
- ❌ Gọi `fetch()` trực tiếp trong page/component — bypass token injection.
- ❌ `localStorage` trực tiếp cho token — dùng `getToken/setToken/clearToken`.
- ❌ Thêm component dùng chung vào `features/<x>/components/` — đó là feature-scope.
  UI primitives reusable đặt ở `components/ui/` hoặc `components/layout/`.
- ❌ Gộp tất cả endpoint vào 1 file (như `lib/api.ts` cũ) — split per-feature.
- ❌ Page có >200 dòng — extract sub-components vào `features/<x>/components/`
  hoặc `components/ui/` nếu reusable.
- ❌ Thêm shadcn/ui không hỏi (chưa setup, sẽ vỡ CSS).
- ❌ Tạo `app/api/...` route handler để gọi NestJS — gọi thẳng từ client qua
  `NEXT_PUBLIC_API_URL`. Server-side proxy chỉ thêm khi có lý do (cookie auth, SSR).
- ❌ Tự `toLocaleString('vi-VN')` cho VND — dùng `formatVND()`.
- ❌ Floating point cho money trong UI logic.

## ESLint

`react-hooks/set-state-in-effect` (rule mới React 19) bị tắt cho:
- `lib/use-auth.ts` — auth bootstrap pattern hợp lệ
- `app/(authed)/layout.tsx`, `app/(authed)/**/page.tsx` — data-fetch effect (không có React Query)
- `features/**/components/**` — modal reset on `open` change
- `features/**/hooks.ts`

Khi migrate sang React Query/SWR, có thể bật lại rule này.

## Run

```bash
pnpm --filter web dev            # http://localhost:3000
pnpm --filter web build
pnpm --filter web lint
```
