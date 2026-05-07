# `apps/web` — Concord NextJS UI

NextJS 16 (App Router) + React 19 + Tailwind v4 + Recharts. Đây là module-level
guide; quy ước chung xem `concord/CLAUDE.md`.

## Layout

```
apps/web/
├── app/
│   ├── layout.tsx              root layout (font + html)
│   ├── globals.css             Tailwind v4 directive
│   ├── page.tsx                landing → redirect /dashboard hoặc /login
│   ├── login/
│   │   └── page.tsx
│   └── (authed)/               route group, mọi page sau login nằm đây
│       ├── layout.tsx          auth gate + sidebar/header chrome
│       ├── _components/        component dùng trong route group này
│       ├── chat/page.tsx
│       ├── dashboard/page.tsx
│       ├── transactions/page.tsx
│       ├── reports/page.tsx
│       ├── goals/page.tsx
│       └── settings/page.tsx
├── lib/
│   ├── api.ts                  fetch wrapper + types mirror API + format helpers
│   └── use-auth.ts             client-side auth bootstrap hook
├── public/
├── next.config.ts
├── postcss.config.mjs          @tailwindcss/postcss
└── tsconfig.json
```

## Auth model

- Token JWT lưu `localStorage` (key `concord_access_token`) — xem [lib/api.ts](lib/api.ts:9).
- `lib/use-auth.ts` exports `useAuth()` hook và `logout()`.
- Mọi protected page sống trong `(authed)/` group → layout `(authed)/layout.tsx`
  tự gate (gọi `me()` để verify token, redirect `/login` nếu 401).
- Trang public (`/login`) ngoài group, không gate.
- KHÔNG có NextAuth (dù `.env` có biến `NEXTAUTH_*` — chỉ dùng để API CORS allowlist).

## Pattern khi thêm route mới

Page client trong `(authed)/`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthedLayout } from '../layout';
import { listFunds, type FundView } from '../../../lib/api';

export default function FoobarPage() {
  const { user } = useAuthedLayout();
  const [data, setData] = useState<FundView[]>([]);

  useEffect(() => {
    void listFunds().then(setData);
  }, []);

  return <main className="p-6">...</main>;
}
```

Luôn:

1. Đặt page vào `(authed)/<route>/page.tsx` (nếu cần auth).
2. Thêm fetcher mới vào `lib/api.ts` thay vì gọi `fetch()` raw — cần kế thừa
   token injection + error handling thống nhất.
3. Type response cũng đặt trong `lib/api.ts` (mirror DTO của API). Đây là
   "shared types" tạm thời cho đến khi có `packages/shared`.
4. Component dùng riêng cho route group đặt trong `(authed)/_components/`,
   chia sẻ rộng hơn → tạm thời cũng đặt đó cho tới khi có thư mục `components/`
   ở top level. Đặt tên kebab-case: `edit-transaction-modal.tsx`.
5. Update sidebar nav trong `(authed)/layout.tsx` (`const NAV = [...]`) nếu route
   xuất hiện trong menu chính.

## Styling

- Tailwind v4 (mới, dùng `@import "tailwindcss"` trong `globals.css`, không phải
  `@tailwind base/components/utilities` cũ).
- Palette dự án: `stone-*` cho neutral, `emerald-*` cho positive/owner,
  `amber-*` cho joint, `sky-*` cho envelope/mục tiêu, `rose-*` cho destructive.
- Number monospace: `font-mono tabular-nums`.
- VND format: dùng `formatVND()` từ `lib/api.ts`, đừng tự `toLocaleString` ad-hoc.
- shadcn/ui: **chưa setup**. Đừng `npx shadcn add ...` mà không discuss trước —
  CSS Tailwind v4 + shadcn cần config riêng. Hiện component tự viết trong
  `_components/`.

## Fetcher pattern (lib/api.ts)

- Mọi call qua `apiFetch<T>(path, init)` — tự inject `Bearer` token, tự handle
  401/204, throw `ApiError`.
- Public call (`login`) thêm `auth: false`.
- Khi thêm endpoint mới: thêm function exported + types tương ứng. Giữ
  alphabetical theo block comment hiện có.

## Anti-patterns thường gặp với Claude Code

- ❌ Tạo `app/<protected>/page.tsx` ngoài `(authed)/` — sẽ không được auth gate.
- ❌ Gọi `fetch()` trực tiếp trong page/component — bypass token injection. Luôn
  qua `lib/api.ts`.
- ❌ `localStorage` trực tiếp cho token — dùng `getToken/setToken/clearToken`.
- ❌ Thêm shadcn/ui không hỏi (chưa setup, sẽ vỡ CSS).
- ❌ Tạo `app/api/...` route handler để gọi NestJS — gọi thẳng từ client qua
  `NEXT_PUBLIC_API_URL`. Server-side proxy chỉ thêm khi có lý do (cookie auth, SSR private data).
- ❌ Tự `toLocaleString('vi-VN')` cho VND — dùng `formatVND()`.
- ❌ Floating point cho money trong UI logic.

## Run

```bash
pnpm --filter web dev            # http://localhost:3000
pnpm --filter web build
pnpm --filter web lint
```
