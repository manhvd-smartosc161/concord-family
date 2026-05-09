# Family multi-tenancy — design spec

**Date**: 2026-05-09
**Status**: Approved (ready for implementation plan)
**Scope**: Refactor Concord từ single-couple deployment sang multi-tenant theo `Family`. Mỗi user thuộc 1 family, mỗi data row scope theo `family_id`. Bao gồm registration flow, family creation, member invitation.

## Mục tiêu

Hiện Concord là single-tenant: 2 user (husband+wife) seed sẵn, mọi fund/transaction/goal share toàn DB. Sau refactor:

- User self-register (email, password, name, gender, birthdate?, weddingDate?)
- Sau register: redirect `/family/setup` để tạo gia đình mới hoặc accept invitation
- Family ≤ 2 members (1 chồng + 1 vợ). User chỉ thuộc 1 family tại 1 thời điểm.
- Mọi fund/transaction/goal/category/important-date/chat scope theo `family_id`
- Privacy 3-quỹ (chồng/vợ/chung) vẫn giữ nguyên trong phạm vi 1 family

## Quyết định đã chốt (brainstorming)

| # | Câu | Quyết định |
|---|-----|-----------|
| 1 | Existing data | **Wipe + restart**. Không migrate. |
| 2 | Invitation method | Email + link với token. SendGrid hiện DMARC fail → log link console + return trong API response cho dev. |
| 3 | User × Family | 1-1 (user chỉ thuộc 1 family). |
| 4 | Family size | Tối đa 2 (chồng + vợ). |
| 5 | Register fields bắt buộc | Email, password, name, gender |
| 5b | Register fields optional | Birthdate, weddingDate |
| 6 | Onboarding khi `familyId == null` | Force redirect `/family/setup` (Tạo / Tham gia bằng link) |
| 7 | Khi nào tạo 3 quỹ chi tiêu | Auto-create khi family đủ 2 spouse |
| 8 | Auto-create important dates | Khi family complete: 2 sinh nhật + 1 kỷ niệm cưới (nếu có data) |

## Architecture

### Approach: `Family` entity + `family_id` NOT NULL trên mọi data table

Loại Approach B (denormalize qua list user_id, JOIN nặng) và C (subdomain per family — overkill).

Ưu điểm Approach A:
- Query đơn giản: `WHERE family_id = currentUser.familyId`
- JWT chứa familyId → guard không cần DB hit
- Cross-family isolation trivial (FK + WHERE check)
- 3-quỹ privacy pattern trong family vẫn work (filter thêm `ownerId === user.id` cho personal funds)

## DB Schema

### New tables

**`families`**
```ts
@Entity('families')
class Family extends BaseEntity {
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'date', nullable: true }) weddingDate: string | null;
  @Column({ type: 'uuid', name: 'created_by_id' }) createdById: string;
  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null; // set khi family đủ 2 spouse → auto-seed funds + important_dates
}
```

**`family_invitations`**
```ts
@Entity('family_invitations')
class FamilyInvitation extends BaseEntity {
  @Column({ type: 'uuid', name: 'family_id' }) familyId: string;
  @Column({ type: 'uuid', name: 'created_by_id' }) createdById: string;
  @Column({ type: 'varchar', length: 320 }) email: string;
  @Column({ type: 'uuid', unique: true }) token: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt: Date;
  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt: Date | null;
  @Column({ type: 'uuid', name: 'accepted_by_id', nullable: true })
  acceptedById: string | null;
}
```

Token TTL = 7 ngày. Mỗi family chỉ có tối đa 1 invitation pending tại 1 thời điểm — gửi mời mới sẽ override (delete) invitation cũ chưa accepted.

### Modified `users` table

Add columns:
- `family_id uuid NULL FK families(id) ON DELETE SET NULL`
- `gender VARCHAR(8) NOT NULL CHECK IN ('male','female')`
- `birthdate DATE NULL`

Existing `role` enum (`'husband'|'wife'`) **giữ nguyên**. Role assignment khi join family:

- User đầu tiên (creator): role = `husband` nếu gender=male, `wife` nếu gender=female
- User thứ 2 (accept invitation): nếu role còn lại (vd creator là husband → assign wife) chưa ai cầm thì lấy role đó. Nếu cả 2 user same-gender → user thứ 2 lấy role ngược với user đầu tiên (vd cả 2 male → user 1 husband, user 2 wife).

Role chỉ ảnh hưởng UI label "Chồng/Vợ" trong header — không enforce nghiệp vụ khắt khe.

Email password unchanged.

### Add `family_id NOT NULL` column to existing data tables

| Table | Column | Notes |
|-------|--------|-------|
| `funds` | `family_id` | Scope toàn bộ fund |
| `transactions` | `family_id` | Denorm từ fund.familyId để query nhanh |
| `goals` | `family_id` | |
| `categories` | `family_id` | Mỗi family có set categories riêng. Seed default 11 cats khi family complete |
| `important_dates` | `family_id` | |
| `chat_sessions` | `family_id` | |
| `chat_messages` | (gián tiếp qua session) | Không cần thêm cột — JOIN qua session |
| `yearly_ai_cache` | `family_id` | Mỗi family có cache năm riêng |
| `salary_rules` | `family_id` | |

### Migration

Wipe + restart: 1 migration drop tất cả data tables, create lại với `family_id NOT NULL`. File: `apps/api/migrations/1779000000000-FamilyMultiTenancy.ts`.

## Auth flow

### Register: `POST /auth/register`

Request:
```ts
{
  email: string;
  password: string;
  name: string;
  gender: 'male' | 'female';
  birthdate?: string; // ISO date
  weddingDate?: string; // ISO date — chỉ dùng làm hint, không lưu
}
```

Response: `{ accessToken: string, user: AuthUser }` — JWT đã có `familyId: null`.

Validation:
- Email unique
- Password min 8 chars
- Gender required
- birthdate optional → lưu vào `users.birthdate`
- weddingDate optional → KHÔNG lưu lúc register (user chưa có family). FE truyền tiếp qua URL/state để prefill `/family/setup` form, user có thể edit/skip ở bước đó.

### Login: `POST /auth/login` (existing, không đổi)

Drop demo buttons UI ở `/login` page.

### `GET /auth/me`

Trả `AuthUser` + check `familyId`. FE dùng để decide redirect.

```ts
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'husband' | 'wife' | null; // null khi chưa join family
  gender: 'male' | 'female';
  familyId: string | null;
  birthdate: string | null;
}
```

### JWT payload

Add `familyId`:
```ts
{ sub: userId, email, role, familyId: string | null, iat, exp }
```

Khi user accept invitation hoặc tạo family → BE issue JWT mới (familyId thay đổi). FE replace token trong localStorage.

## Family endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/families` | Tạo family mới (user phải `familyId=null`). Gắn user vào family ngay. |
| GET | `/api/families/me` | Get family hiện tại + members |
| POST | `/api/families/me/invitations` | Tạo invitation. Body: `{ email }`. Return `{ token, link, expiresAt }`. Gửi email (best-effort) + log link. |
| GET | `/api/families/invitations/:token` | Public — get invitation info (familyName, inviterName, validity). FE pre-fill email khi register/login. |
| POST | `/api/families/invitations/:token/accept` | Auth required. Gắn user vào family invitation đó. Trigger family completion nếu đủ 2 spouse. |

### Family completion trigger

Khi family có đủ 2 user (`members.length === 2` — không strict-enforce gender mix), service `FamiliesService.completeIfReady(familyId)`:

1. Set `family.completedAt = NOW()` (idempotent — early return nếu đã set)
2. Auto-create 3 funds:
   - `Quỹ <U1.name>` — type=personal, ownerId=U1, familyId
   - `Quỹ <U2.name>` — type=personal, ownerId=U2, familyId
   - `Quỹ Chung` — type=joint, ownerId=null, familyId
3. Auto-create default categories cho family (clone từ `DEFAULT_CATEGORIES` const trong `apps/api/src/seed.ts`, gắn `familyId`)
4. Auto-create important dates:
   - If U1.birthdate → `Sinh nhật <U1.name>`
   - If U2.birthdate → `Sinh nhật <U2.name>`
   - If family.weddingDate → `Kỷ niệm cưới`
5. Default `remindDaysBefore: [0, 7]`, `isLunar: false`

## Privacy enforcement

### Backend

`FamilyRequiredGuard` (NestJS guard, applied global to authed routes via app module config):

```ts
@Injectable()
class FamilyRequiredGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user.familyId) {
      throw new ForbiddenException('Bạn chưa thuộc gia đình nào.');
    }
    return true;
  }
}
```

Apply sau `JwtAuthGuard`. Endpoints cần exempt: `/api/auth/*`, `/api/families` (POST tạo new), `/api/families/invitations/:token` (GET + accept).

Mỗi service đụng data scope theo `user.familyId`:

```ts
// funds.service.ts
async listForFamily(user: User): Promise<FundView[]> {
  const all = await this.fundRepo.find({ where: { familyId: user.familyId! } });
  // Apply 3-fund privacy WITHIN family
  return all.filter(
    (f) => f.type === 'joint' || f.ownerId === user.id,
  );
}
```

Pattern này thay thế `visibleFundIds(user)` hiện có.

### Frontend

`(authed)/layout.tsx` thêm check sau auth load:

```ts
useEffect(() => {
  if (auth.status === 'authed' && !auth.user.familyId) {
    router.replace('/family/setup');
  }
}, [auth]);
```

Pages dưới `/family/*` không cần familyId guard (chính chúng setup family).

## Web pages

### `/register` (new)

Form:
- Email, password, confirm password
- Name (Tên hiển thị)
- Gender radio: Nam / Nữ
- Birthdate (optional)
- Wedding date (optional, hint: "Bạn có thể bỏ qua, nhập sau khi tạo gia đình")
- Submit → `POST /auth/register` → save token → redirect `/family/setup`

### `/login` (modified)

- Drop "Tài khoản demo" section
- Thêm link "Chưa có tài khoản? Đăng ký"

### `/family/setup` (new — authed)

Hiển thị 2 card lựa chọn:

**Card A — Tạo gia đình mới**
- Form: tên gia đình (default: `Gia đình ${user.name}`), wedding date (prefill từ register nếu có)
- POST `/api/families` → save new JWT → redirect `/family/invite`

**Card B — Tham gia bằng link**
- Hint: "Mở link mời từ email vợ/chồng đã gửi"
- Hoặc paste invitation token + button "Chấp nhận"
- POST `/api/families/invitations/:token/accept` → save new JWT → redirect `/dashboard`

### `/family/invite` (new — authed)

- Hiển thị thông tin family + member list (chỉ user)
- Form: input email + button "Gửi link mời"
- POST `/api/families/me/invitations` → hiển thị status:
  - "Đã gửi đến `<email>`. Pending..."
  - **DEV mode**: hiện link cụ thể để copy (response từ BE chứa link)
- Khi member 2 accept → realtime poll `/api/families/me` → khi `members.length === 2` → redirect `/dashboard`

### `/invite/[token]` (new — public)

- GET `/api/families/invitations/:token` → display:
  - "Bạn được mời tham gia `<family.name>` bởi `<inviter.name>`"
  - 2 button: "Đăng nhập để chấp nhận" (`→ /login?next=/invite/<token>`) / "Đăng ký mới" (`→ /register?next=/invite/<token>`)
- Sau login/register, redirect tự động về `/invite/<token>` → auto POST accept → redirect `/dashboard`

## Out of scope (MVP)

- User rời family / divorce / dissolve family
- Chuyển owner family
- Multiple families per user
- > 2 members per family (kids, parents)
- Same-gender role assignment edge cases (just allow, role = first available)
- Real email delivery (SendGrid DMARC blocked — log link to console + return in API response)
- Re-invite UX with status tracking (just delete + create new invitation)
- Invitation revoke endpoint (cancel before accept) — phase 2 nếu cần
_(Token được issue lại sau create-family/accept-invitation — nằm in scope.)_

## Files affected

**API new:**
- `apps/api/src/modules/families/family.entity.ts`
- `apps/api/src/modules/families/family-invitation.entity.ts`
- `apps/api/src/modules/families/families.module.ts`
- `apps/api/src/modules/families/families.service.ts`
- `apps/api/src/modules/families/families.controller.ts`
- `apps/api/src/modules/families/dto/{create-family,create-invitation}.dto.ts`
- `apps/api/src/shared/auth/guards/family-required.guard.ts`
- `apps/api/migrations/1779000000000-FamilyMultiTenancy.ts`

**API modified:**
- `apps/api/src/modules/users/entities/user.entity.ts` — add familyId/gender/birthdate
- `apps/api/src/modules/users/users.service.ts` — register method
- `apps/api/src/shared/auth/auth.service.ts` — register endpoint, JWT payload
- `apps/api/src/shared/auth/auth.controller.ts` — POST /register
- `apps/api/src/shared/auth/strategies/jwt.strategy.ts` — include familyId
- `apps/api/src/seed.ts` — wipe seed (only seed admin or empty)
- 7 entities (funds, transactions, goals, categories, important_dates, chat_sessions, yearly_ai_cache, salary_rules) — add familyId column
- 7 services — scope by familyId
- `apps/api/src/data-source.ts` — register Family + FamilyInvitation entities
- `apps/api/src/app.module.ts` — register FamiliesModule

**Web new:**
- `apps/web/app/register/page.tsx`
- `apps/web/app/(authed)/family/setup/page.tsx`
- `apps/web/app/(authed)/family/invite/page.tsx`
- `apps/web/app/invite/[token]/page.tsx`
- `apps/web/features/families/api.ts`
- `apps/web/features/families/types.ts`

**Web modified:**
- `apps/web/app/login/page.tsx` — drop demo buttons, add register link
- `apps/web/app/(authed)/layout.tsx` — guard familyId redirect
- `apps/web/features/auth/types.ts` — add familyId/gender/birthdate to AuthUser
- `apps/web/features/auth/api.ts` — register function
- `apps/web/components/layout/sidebar.tsx` — add link "Gia đình" → /family/invite

## Acceptance criteria

1. User mới register → redirect /family/setup, không vào /dashboard được
2. Tạo family → JWT update có familyId → redirect /family/invite
3. Gửi invitation → BE trả link, log console (vì SendGrid block)
4. Mở link `/invite/<token>` (chưa login) → register hoặc login → auto accept → /dashboard
5. Family complete (2 spouse) → tự động tạo 3 quỹ + 11 categories + (≤3) important dates
6. Mọi query data có `WHERE family_id = currentUser.familyId` — không thể leak sang family khác
7. Privacy 3-fund trong family vẫn work: U1 không thấy giao dịch của Quỹ U2
8. `pnpm --filter api lint`, `pnpm --filter api build`, `pnpm --filter web lint`, `tsc --noEmit` đều pass
