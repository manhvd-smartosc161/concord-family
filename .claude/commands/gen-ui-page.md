---
description: Tạo page mới + feature slice (api/types/components) trong NextJS web theo pattern Concord
argument-hint: <route> (vd "budgets" hoặc "settings/notifications")
---

Tôi muốn tạo page `/$ARGUMENTS` trong `apps/web/`.

Trước khi viết code:

1. Đọc `apps/web/CLAUDE.md` để nắm convention (route group `(authed)`, feature-first, fetcher qua `@/lib/api-client`, palette Tailwind, formatVND, không shadcn).
2. Đọc `apps/web/app/(authed)/transactions/page.tsx` + `apps/web/features/transactions/` làm reference (page + feature slice).
3. Hỏi tôi 2 câu trước khi gen:
   - Page có cần auth không? (mặc định có → đặt trong `(authed)/`)
   - Page fetch data từ endpoint nào của API? (nếu chưa có endpoint → list ra để tôi confirm trước khi viết, KHÔNG tự bịa endpoint)

Sau khi tôi trả lời:

**Tạo feature slice trước**, vào `apps/web/features/$ARGUMENTS/`:

- `api.ts` — function fetch qua `apiFetch<T>` từ `@/lib/api-client`. Typed.
- `types.ts` — mirror DTO của API. Đây là "shared types" tạm thời.
- `components/` — component riêng cho feature (kebab-case file name).
- `hooks.ts` (optional) — nếu logic fetch + state phức tạp.

**Rồi tạo page** `apps/web/app/(authed)/$ARGUMENTS/page.tsx`:

- `'use client'` trừ khi tôi nói khác
- Import từ `@/features/$ARGUMENTS/api`, `@/features/$ARGUMENTS/types`, `@/features/$ARGUMENTS/components/`
- UI primitives từ `@/components/ui`
- Page nên <100 dòng — extract logic vào `features/$ARGUMENTS/components/` nếu phình to
- VND dùng `formatVND()` từ `@/lib/format`
- Tailwind palette: `stone-*` neutral, `emerald-*` positive, `amber-*` joint, `sky-*` envelope, `rose-*` destructive

**Update sidebar** nếu route chính: edit `NAV` array trong `apps/web/components/layout/sidebar.tsx`.

**Đừng**:
- Tạo `app/api/...` route handler nếu không có lý do
- Cài shadcn/ui
- Gọi `fetch()` raw
- Đụng `localStorage` trực tiếp

Cuối cùng:

- KHÔNG thêm comment trong code
- Run `pnpm --filter web lint && pnpm --filter web build` để verify
- Báo tôi mở `http://localhost:3000/$ARGUMENTS` để check trên browser
