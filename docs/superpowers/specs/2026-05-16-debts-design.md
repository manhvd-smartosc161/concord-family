# Nợ & Cho vay (Debts) — Design Spec

**Date**: 2026-05-16
**Scope**: Backend module `debts` + Frontend feature `debts` + AI chat action integration

---

## 1. Mục tiêu

Theo dõi các khoản **nợ** (tôi đang nợ ai — thẻ tín dụng, bạn bè cho vay) và **cho vay** (người khác đang nợ tôi). Outstanding (số tiền còn lại) cập nhật theo từng payment. Mỗi payment có thể link với một Transaction trong fund.

AI chat extract: khi user chat "vừa trả thẻ Sacombank 2 triệu", AI fuzzy-match debt phù hợp, propose action card; user confirm → tạo Transaction + Payment record + giảm outstanding.

## 2. Non-goals (Phase 2 — không làm)

- Lãi suất tính tự động
- Recurring debt (thẻ tín dụng có sao kê tháng)
- Reminder/notification tự động (chỉ manual link với important-dates nếu cần)
- Multi-currency
- Sync API ngân hàng
- KPI debt trên Reports page

## 3. Data model

### `Debt` (apps/api/src/modules/debts/entities/debt.entity.ts)

| Field | Type | Note |
|---|---|---|
| id | uuid PK | |
| ownerId | uuid FK users | user tạo, privacy anchor |
| familyId | uuid FK families | scope gia đình |
| direction | enum('i_owe', 'they_owe_me') | hướng nợ |
| counterparty | varchar(200) | "Thẻ Sacombank", "Anh Tuấn" |
| principal | bigint | số tiền gốc (VND integer) |
| outstanding | bigint | denormalized = principal − sum(payments) |
| visibility | enum('private', 'shared') | default 'private' |
| dueDate | date nullable | |
| note | text nullable | |
| status | enum('open', 'closed') | auto-close khi outstanding = 0 |
| createdAt | timestamp | |
| updatedAt | timestamp | |
| closedAt | timestamp nullable | |

### `DebtPayment` (apps/api/src/modules/debts/entities/debt-payment.entity.ts)

| Field | Type | Note |
|---|---|---|
| id | uuid PK | |
| debtId | uuid FK debts ON DELETE CASCADE | |
| transactionId | uuid FK transactions ON DELETE SET NULL | link optional |
| amount | bigint | số tiền payment (luôn dương) |
| paidAt | timestamp | |
| note | text nullable | |
| createdAt | timestamp | |

### Invariants

- `principal > 0`
- `0 ≤ outstanding ≤ principal`
- `outstanding = principal − sum(active payments where transactionId is not deleted)`
- Khi `outstanding = 0`: auto set `status = 'closed'`, `closedAt = now()`
- Khi payment add/remove/update → recompute outstanding của parent debt
- Khi PATCH `principal`: nếu `newPrincipal < sum(payments)` → reject với 400 "Số gốc mới nhỏ hơn tổng đã trả"

## 4. Privacy & visibility

Cùng pattern với `transactions` (privacy inline trong service, không global guard):

- `visibility = 'private'`: chỉ `ownerId` thấy.
- `visibility = 'shared'`: tất cả members cùng `familyId` thấy LIST + DETAIL nhưng chỉ `ownerId` được EDIT/DELETE/CLOSE.
- List filter: `familyId = currentUser.familyId AND (visibility = 'shared' OR ownerId = currentUser.id)`.
- `DebtPayment` inherit privacy của parent `Debt`.

## 5. API endpoints

REST trong `apps/api/src/modules/debts/`:

```
GET    /debts?status=&direction=&visibility=    list (default status=open)
GET    /debts/:id                               detail + payments[]
POST   /debts                                   create (body: direction, counterparty, principal, visibility, dueDate?, note?)
PATCH  /debts/:id                               update meta (counterparty, dueDate, visibility, note, principal)
DELETE /debts/:id                               delete (cascade payments)
POST   /debts/:id/close                         manual close
POST   /debts/:id/reopen                        reopen

POST   /debts/:id/payments                      body: { amount, paidAt, transactionId?, note? }
DELETE /debts/:id/payments/:paymentId

POST   /debts/match                             body: { counterparty: string } → top 2 fuzzy matches (cho AI)
```

DTOs validate qua `class-validator`. All routes auth-gated (JWT). All write ops check ownership for private + edit perms for shared.

## 6. AI extract flow

Hai `ParseAction` kinds mới trong `apps/api/src/agent/subagents/parser/` types:

### `debt_payment_proposed`

```ts
{
  kind: 'debt_payment_proposed',
  debtMatches: [{ id, counterparty, outstanding, score }],  // top 1-2 fuzzy
  amount: number,
  fundId: string,        // AI guess fund từ context
  direction: 'i_owe' | 'they_owe_me',
  paidAt: string (ISO),
  raw: string
}
```

Frontend confirm card:
```
💳 Trả nợ?
  Khoản: [Thẻ Sacombank — còn 8.000.000đ] ▼  (combobox + "+ Tạo mới")
  Số tiền: 200.000đ
  Quỹ: [Quỹ Mạnh] ▼
  [Xác nhận]  [Bỏ qua]
```

Confirm:
1. POST `/transactions` — expense at fundId, category seed "Trả nợ"/"Cho vay"
2. POST `/debts/:id/payments` with `transactionId` from step 1

### `debt_proposed`

```ts
{
  kind: 'debt_proposed',
  direction: 'i_owe' | 'they_owe_me',
  counterparty: string,
  principal: number,
  fundId: string | null,  // optional: tiền vào/ra fund nào
  raw: string
}
```

Confirm → POST `/debts` + (optional) POST `/transactions` if fundId.

### Fuzzy match

Service method `DebtsService.matchCounterparty(family, input): top 2`:
- PostgreSQL `pg_trgm` extension (đã có pgvector — kích hoạt `CREATE EXTENSION pg_trgm`)
- `SELECT * FROM debts WHERE family_id=? AND status='open' ORDER BY similarity(counterparty, $1) DESC LIMIT 2`
- Threshold `similarity >= 0.4`; nếu không qua threshold → return empty (AI sẽ propose "+ Tạo mới")

### Subagent prompt update

Cập nhật `apps/api/src/agent/subagents/parser/skill.md`:
- Thêm 2 action kinds vào output schema
- Thêm 2-3 example tiếng Việt: "trả thẻ Sacombank 2tr", "vay anh Tuấn 5 triệu mua xe", "em Hằng vay 3 triệu"
- Hint: nếu mention thẻ tín dụng / ngân hàng / tên người + "vay" / "trả" → emit debt action

## 7. Frontend structure

### Feature slice `apps/web/features/debts/`

```
features/debts/
├── api.ts          listDebts, getDebt, createDebt, updateDebt, deleteDebt,
│                   closeDebt, reopenDebt, createPayment, deletePayment, matchDebts
├── types.ts        DebtView, DebtPaymentView, DebtDirection, DebtVisibility, DebtStatus
└── components/
    ├── debt-card.tsx           1 debt card (counterparty + outstanding + dueDate + status badge + visibility icon)
    ├── debt-list.tsx           grouped by direction
    ├── debt-form-modal.tsx     create/edit
    ├── debt-detail-modal.tsx   chi tiết + payments timeline + add/delete payment + close/reopen
    └── payment-form-modal.tsx  thêm payment manual (chọn fund + amount + note + paidAt)
```

### Page `apps/web/app/(authed)/debts/page.tsx`

Layout:
```
┌────────────────────────────────────────────────┐
│ Nợ & Cho vay         [+ Thêm khoản nợ/cho vay] │
│ 3 đang nợ · 2 đang cho vay                     │
├────────────────────────────────────────────────┤
│  3 KPI cards: Tôi đang nợ | Người ta nợ tôi | Net │
├────────────────────────────────────────────────┤
│ Filter: status | direction | visibility | search │
├────────────────────────────────────────────────┤
│ 💳 Tôi đang nợ                                 │
│   [DebtCard...]                                │
│                                                │
│ 🤝 Đang cho vay                                │
│   [DebtCard...]                                │
└────────────────────────────────────────────────┘
```

Click 1 card → `DebtDetailModal`.

### Sidebar update

`apps/web/components/layout/sidebar.tsx` `NAV`: thêm entry trong group "Tài chính" (sau "Tiết kiệm & Đầu tư"):
```
{ key: 'debts', icon: '💳', labelKey: 'nav.debts', href: '/debts' }
```

### Chat action card

`apps/web/app/(authed)/chat/page.tsx` `ActionCard` switch: thêm 2 case `debt_proposed`, `debt_payment_proposed` render card với combobox + form fields. Khi confirm → call APIs theo flow §6.

## 8. Migrations & seed

### Migration (1 file)

`apps/api/migrations/<timestamp>-create-debts.ts`:

```sql
-- Enable trigram (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE debt_direction AS ENUM ('i_owe', 'they_owe_me');
CREATE TYPE debt_visibility AS ENUM ('private', 'shared');
CREATE TYPE debt_status AS ENUM ('open', 'closed');

CREATE TABLE debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  family_id uuid NOT NULL REFERENCES families(id),
  direction debt_direction NOT NULL,
  counterparty varchar(200) NOT NULL,
  principal bigint NOT NULL CHECK (principal > 0),
  outstanding bigint NOT NULL CHECK (outstanding >= 0),
  visibility debt_visibility NOT NULL DEFAULT 'private',
  due_date date,
  note text,
  status debt_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX idx_debts_family_owner_status ON debts(family_id, owner_id, status);
CREATE INDEX idx_debts_family_visibility ON debts(family_id, visibility);
CREATE INDEX idx_debts_counterparty_trgm ON debts USING gin (counterparty gin_trgm_ops);

CREATE TABLE debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
```

Down migration: drop tables + types in reverse.

### Seed

Update `apps/api/src/seeds/categories.seed.ts` (hoặc tương đương): thêm 2 default category VN:
- `💳 Trả nợ` (kind: expense)
- `🤝 Cho vay` (kind: expense)
- `💰 Nhận tiền vay` (kind: income, cho action `debt_proposed` direction `i_owe` khi user vay tiền vào quỹ)
- `↩️ Nhận trả nợ` (kind: income, cho payment khi `they_owe_me` được trả lại)

### i18n

Add `debts` namespace tới `apps/web/messages/vi.json` + `en.json`:
- title, subtitle, kpi labels, direction labels, status labels, form labels, action confirmation strings, empty state.
- `nav.debts` trong common nav.

## 9. Backend module structure

```
apps/api/src/modules/debts/
├── debts.module.ts
├── debts.controller.ts
├── debts.service.ts             CRUD + recomputeOutstanding + autoCloseIfPaid
├── debt-payments.service.ts     payment CRUD (split if grow > 300 lines)
├── debts-match.service.ts       fuzzy match via pg_trgm
├── dto/
│   ├── create-debt.dto.ts
│   ├── update-debt.dto.ts
│   ├── create-payment.dto.ts
│   └── match-debt.dto.ts
└── entities/
    ├── debt.entity.ts
    └── debt-payment.entity.ts
```

Privacy enforcement INLINE trong service methods (`visibleDebtsFor(user)`, `assertCanEdit(debt, user)`).

## 10. Testing

- **Unit**: `DebtsService.recomputeOutstanding()` — sum payments correct, auto-close at 0.
- **Unit**: `DebtsMatchService.matchCounterparty()` — top 2 results ranked by similarity, threshold cut-off.
- **Integration**: User A creates private debt → User B (same family) cannot list/get/edit.
- **Integration**: Shared debt — User B lists OK, edits FORBIDDEN.
- **Manual QA**:
  - Create debt manual → list shows
  - Add payment manual → outstanding giảm
  - Trả hết → status auto = closed
  - Chat "trả thẻ Sacombank 2tr quỹ Mạnh" → action card → confirm → transaction created + payment + outstanding updated
  - Chat "anh A vay 3tr" → confirm → debt created (direction `they_owe_me`)
- **Migration**: `pnpm --filter api migration:run` clean, rollback test

## 11. Risks

| Risk | Mitigation |
|---|---|
| Race khi multiple payments create concurrent → outstanding mismatch | Recompute trong transaction (TypeORM `@Transaction`), lock row via `SELECT FOR UPDATE` |
| AI tạo trùng debt (sacombank vs Sacombank) | Fuzzy match threshold + "+ Tạo mới" chỉ là option cuối, không auto-create |
| Transaction xóa nhưng payment vẫn ref | FK `ON DELETE SET NULL` — payment record vẫn còn, chỉ unlink. UI hiển thị "(Giao dịch đã xóa)" |
| pg_trgm extension chưa có trên prod | Migration `CREATE EXTENSION IF NOT EXISTS pg_trgm` (cần SUPERUSER hoặc pre-installed) |

## 12. Implementation phases (gợi ý cho plan)

1. **Backend foundation**: migration + entities + DTOs + module skeleton
2. **Backend CRUD**: DebtsService + DebtsController (no AI yet) + privacy tests
3. **Backend payments**: DebtPaymentsService + recompute + autoClose
4. **Backend match**: DebtsMatchService + pg_trgm + `/debts/match` endpoint
5. **Frontend feature slice**: api.ts + types.ts + components (no chat yet)
6. **Frontend page**: `/debts` page + sidebar entry + i18n
7. **Chat AI integration**: parser action kinds + action cards + confirm flows + seed new categories
8. **QA pass**: manual checklist + edge cases

Mỗi phase commit riêng để dễ revert.
