# Edit Profile — Design Spec

**Date**: 2026-05-11
**Status**: Approved

## Summary

Add inline profile editing to the Settings page. Users can edit their display name, birthdate, and upload a profile photo. Avatar is stored in Supabase Storage; URL is persisted in the `users` table.

---

## 1. Data Layer

### 1.1 Database

New column on `users` table:

```sql
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL;
```

Generated as a TypeORM migration: `AddAvatarUrlToUsers`.

### 1.2 API changes

**Existing endpoint** `PATCH /api/auth/me` — already handles `name` + `birthdate`, no changes needed.

**New endpoint** `POST /api/auth/me/avatar`:
- Body: `multipart/form-data`, field name `file`
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max size after resize: 2MB
- Server resizes image to max 400×400px using `sharp` before upload
- Uploads to Supabase Storage bucket `avatars`, path: `{userId}/{timestamp}.{ext}`
- Deletes previous avatar file from Storage only after new upload succeeds
- Returns `AuthUserDto` with updated `avatarUrl`

**`AuthUserDto`** (API) and **`AuthUser`** (web types) — add field:

```ts
avatarUrl: string | null;
```

### 1.3 Supabase Storage setup

- Bucket name: `avatars`
- Visibility: public read (anonymous GET allowed)
- RLS: only service role key can write/delete (API uses service role key)

---

## 2. Backend Implementation

### 2.1 Dependencies

Add `sharp` to `apps/api` for server-side image resizing.
Add `@supabase/supabase-js` to `apps/api` (or reuse if already present).

### 2.2 New env vars (Render + `.env.example`)

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### 2.3 AvatarService (new, in `src/shared/avatar/`)

Responsibilities:
- `upload(userId, fileBuffer, mimeType)` → resizes with `sharp`, uploads to Supabase Storage, returns public URL
- `delete(avatarUrl)` → extracts path from URL, deletes from Supabase Storage

### 2.4 AuthController additions

```ts
@UseGuards(JwtAuthGuard)
@Post('me/avatar')
@UseInterceptors(FileInterceptor('file'))
async uploadAvatar(
  @CurrentUser() user: User,
  @UploadedFile() file: Express.Multer.File,
): Promise<AuthUserDto>
```

Validation: pipe rejects non-image MIME types and files > 5MB (before resize).

---

## 3. Frontend Implementation

### 3.1 `features/auth/api.ts`

Add:

```ts
export function uploadAvatar(file: File): Promise<AuthUser>
```

Uses `FormData`, sends to `POST /api/auth/me/avatar`.

### 3.2 `AccountSection` — two modes

**View mode** (default):
- Avatar circle top-left of card (image if `user.avatarUrl`, else initials + role color)
- Name, role, email, ID displayed as read-only fields
- "Chỉnh sửa" button top-right

**Edit mode** (activated by "Chỉnh sửa"):
- Avatar circle with camera icon overlay; clicking opens hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`
- Instant local preview after file selected (before save)
- Client validates: MIME type + max 5MB; shows inline error under avatar if invalid
- "Tên" → `<input>` editable (required, trimmed)
- "Ngày sinh" → `<input type="date">` (optional, not future date)
- Role, email, ID remain read-only
- Footer: "Huỷ" button (resets state, exits edit mode) + "Lưu" button (disabled if no changes, disabled while saving)

**Save sequence**:
1. If new avatar file selected → `POST /api/auth/me/avatar`
2. If name or birthdate changed → `PATCH /api/auth/me`
3. On success → call layout context `reloadUser()` → exit edit mode
4. On any error → show inline error message, stay in edit mode

**Avatar fallback** (no photo): circle with user's initials, colored by role (`bg-emerald-100 text-emerald-800` for husband, `bg-amber-100 text-amber-800` for wife).

### 3.3 `useAuth` hook + layout context

`useAuth` currently has no way to refresh user state after a profile update. Add a `reloadUser` function to the hook that re-calls `me()` and updates local state. Expose it through `LayoutCtx` alongside existing `reloadFunds`.

### 3.4 Layout / Header

Sidebar header already renders `user.name`. Update to also render avatar circle using same fallback logic. No structural changes needed — just reads from existing layout context user object.

---

## 4. Error Handling

| Scenario | Behavior |
|---|---|
| File wrong MIME type | Client: inline error under avatar, no upload |
| File > 5MB | Client: inline error under avatar, no upload |
| Supabase Storage upload fails | Server returns 502; client shows inline error, stays in edit mode |
| Name empty after trim | Client: disable Lưu button; server: 400 |
| Birthdate in future | Client: inline error on date field |
| Double-submit | Lưu button disabled while request in flight |
| Old avatar delete fails | Log server-side warning, do not fail the request (new URL already saved) |

---

## 5. Constraints & Non-goals

- Email and role are **not editable** (email change requires verification flow out of scope; role is set at family setup).
- Gender is **not editable** in this spec.
- No image crop UI — resize handled server-side to 400×400 (cover fit).
- No avatar for the other spouse — each user manages their own profile.
- Supabase Storage bucket must be created manually before deploy (one-time setup).
