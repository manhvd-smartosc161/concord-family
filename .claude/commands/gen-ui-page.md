---
description: Tạo page mới trong NextJS web app theo pattern Concord (App Router + (authed) group + lib/api fetcher)
argument-hint: <route> (vd "budgets" hoặc "settings/notifications")
---

Tôi muốn tạo page mới ở route `/$ARGUMENTS` trong `apps/web/`.

Trước khi viết code:

1. Đọc `apps/web/CLAUDE.md` để nắm convention (route group `(authed)`, fetcher qua `lib/api.ts`, palette Tailwind, formatVND, không shadcn).
2. Đọc `apps/web/app/(authed)/transactions/page.tsx` và `apps/web/app/(authed)/dashboard/page.tsx` làm reference (layout, fetch pattern, useAuthedLayout).
3. Hỏi tôi 2 câu trước khi gen:
   - Page có cần auth không? (mặc định có → đặt trong `(authed)/`)
   - Page fetch data từ endpoint nào của API? (nếu chưa có endpoint → list ra để tôi confirm trước khi viết, KHÔNG tự bịa endpoint)

Sau khi tôi trả lời:

- Tạo `apps/web/app/(authed)/$ARGUMENTS/page.tsx` (hoặc `app/$ARGUMENTS/page.tsx` nếu là public)
- Page là `'use client'` trừ khi tôi nói khác
- Fetch qua function trong `lib/api.ts`. Nếu function chưa có → thêm vào `lib/api.ts` (typed, qua `apiFetch<T>`). KHÔNG dùng `fetch()` raw, KHÔNG đụng `localStorage` trực tiếp.
- Type response mirror DTO của API → khai trong `lib/api.ts`
- Tailwind v4, palette: `stone-*` neutral, `emerald-*` positive, `amber-*` joint, `sky-*` envelope, `rose-*` destructive
- VND dùng `formatVND()` từ `lib/api.ts`
- Component riêng cho page → đặt cùng folder, hoặc `(authed)/_components/<kebab>.tsx` nếu reuse
- Nếu là route chính → cập nhật `NAV` trong `app/(authed)/layout.tsx`
- KHÔNG cài shadcn, KHÔNG tạo `app/api/...` route handler nếu không có lý do

Cuối cùng:

- KHÔNG thêm comment trong code
- Run `pnpm --filter web lint` để verify
- Báo tôi mở `http://localhost:3000/$ARGUMENTS` để check trên browser
