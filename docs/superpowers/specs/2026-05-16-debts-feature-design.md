# Debts & Loans — Design Spec

**Ngày**: 2026-05-16
**Trạng thái**: Approved, sẵn sàng cho writing-plans
**Mục tiêu**: Cho phép user track các khoản **cho vay** (lent) và **đi vay** (borrowed) — tạo qua chat hoặc UI, hỗ trợ **trả từng phần** (partial payments), tự cập nhật balance quỹ.

## Vấn đề & ngữ cảnh

Concord hiện chỉ track thu/chi trong 3 quỹ chi tiêu + quỹ savings/investment. Khi user "cho Hoàng vay 15 triệu" hoặc "vay ngân hàng 100 triệu", không có cách nào ghi nhận đây là một khoản có ngày trả lại. Hiện workaround duy nhất là log expense rồi tự nhớ — dễ mất dấu, không thấy được tổng nợ outstanding.

**Use case chính**:
- Chat: "cho Hoàng vay 15 triệu" → tự tạo Debt (lent) + trừ 15tr khỏi quỹ cá nhân của user.
- Chat: "tôi vay VCB 100 triệu" → tự tạo Debt (borrowed) + cộng 100tr vào quỹ.
- Chat: "Hoàng trả 5 triệu" → ghi nhận partial payment, balance còn 10tr.
- UI `/debts`: xem tổng cho vay/đi vay, list khoản đang mở, ghi trả nhanh.

## Quyết định thiết kế (đã chốt)

1. **Cash flow**: Mở khoản trừ/cộng ngay vào quỹ (như expense/income thật). Trả nợ cũng tạo transaction ngược chiều.
2. **Partial payments**: Có. Mỗi khoản nợ có nhiều lần trả; tự `settled` khi sum = principal.
3. **Lãi suất**: Không trong MVP. Nếu sau này cần, user log lãi như expense thường với category "Lãi vay".
4. **Counterparty**: Free-text string, không có entity riêng.
5. **Quỹ mặc định khi chat không nói rõ**: Quỹ cá nhân của user đang login.
6. **Privacy**: Theo luật quỹ hiện tại — debt gắn fund; quỹ riêng chỉ owner thấy, quỹ chung cả vợ chồng thấy.
7. **UI**: Trang `/debts` với summary cards + tabs (Cho vay / Đi vay / Đã đóng) + dialog ghi trả nhanh.

## Architecture (hướng A — module riêng, link Transaction)

```
apps/api/src/modules/debts/
├── debts.module.ts
├── debts.controller.ts
├── debts.service.ts
├── dto/
│   ├── create-debt.dto.ts
│   └── record-payment.dto.ts
└── entities/
    ├── debt.entity.ts
    └── debt-payment.entity.ts
```

Debt là domain riêng; Transaction vẫn là source of truth cho cash flow trong quỹ. Bảng `debt_payments` link 2 bên (mỗi action sinh 1 transaction). Privacy + balance update reuse hoàn toàn `TransactionsService` hiện tại.

## Data model

### Entity `Debt`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | BaseEntity |
| `familyId` | uuid | indexed |
| `userId` | uuid | người tạo |
| `fundId` | uuid | indexed; quỹ nguồn (lent) hoặc đích (borrowed) |
| `direction` | enum `'lent' \| 'borrowed'` | |
| `counterpartyName` | text | "Hoàng", "VCB", "Mẹ" — không normalize |
| `principal` | bigint (VND, integer) | số tiền gốc, immutable sau khi tạo |
| `remainingAmount` | bigint | giảm dần khi trả; >= 0 |
| `status` | enum `'open' \| 'settled'` | default `'open'` |
| `note` | text nullable | |
| `openedAt` | timestamptz | mặc định = `createdAt` |
| `closedAt` | timestamptz nullable | set khi `status -> settled` |

Indexes: `(familyId)`, `(fundId)`, `(userId, status)`.

### Entity `DebtPayment`

Link 1-1 giữa Debt action ↔ Transaction.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `debtId` | uuid → debts.id ON DELETE CASCADE | |
| `transactionId` | uuid → transactions.id ON DELETE CASCADE, UNIQUE | |
| `kind` | enum `'open' \| 'repayment'` | `open` = transaction lúc mở khoản; `repayment` = trả từng phần |
| `amount` | bigint | luôn dương; = `\|transaction.amount\|`; với `kind='open'` thì = `principal` |
| `createdAt` | timestamptz | |

### Cash flow rules

| Action | Direction | Sign của Transaction.amount | Effect lên fund.balance |
|---|---|---|---|
| Mở khoản | lent | `-principal` | giảm |
| Mở khoản | borrowed | `+principal` | tăng |
| Trả từng phần | lent (đối tác trả mình) | `+amount` | tăng |
| Trả từng phần | borrowed (mình trả đối tác) | `-amount` | giảm |

### Default categories (seed)

Thêm 3 category VN khi seed family mới (nếu chưa có):
- `"Cho vay"` — `isEssential=false`, không có parent — dùng khi mở khoản `direction='lent'`
- `"Đi vay"` — `isEssential=false`, không có parent — dùng khi mở khoản `direction='borrowed'`
- `"Trả nợ"` — `isEssential=false`, không có parent — dùng cho mọi payment (cả 2 direction)

Service auto-assign theo bảng trên. MVP không cho user override category khi tạo qua chat/UI debt (giữ deterministic). User vẫn có thể sửa category của transaction bằng update_transaction nếu muốn.

## API endpoints

Module: `DebtsModule`. Prefix: `/api/debts`. Tất cả `@UseGuards(JwtAuthGuard)`.

| Method | Path | Body / Query | Trả về |
|---|---|---|---|
| `GET` | `/api/debts` | query `?status=open\|settled\|all` (default `open`), `?direction=lent\|borrowed\|all` (default `all`) | `DebtView[]` (sorted by openedAt desc) |
| `GET` | `/api/debts/summary` | — | `{ totalLent, totalBorrowed, openLentCount, openBorrowedCount }` — chỉ tính status=open |
| `GET` | `/api/debts/:id` | — | `DebtView` + `payments: DebtPaymentView[]` |
| `POST` | `/api/debts` | `CreateDebtDto` | `DebtView` |
| `POST` | `/api/debts/:id/payments` | `RecordPaymentDto` | `{ debt: DebtView, payment: DebtPaymentView }` |
| `DELETE` | `/api/debts/:id/payments/:paymentId` | — | `DebtView` (sau rollback) |
| `DELETE` | `/api/debts/:id` | — | `{ ok: true }` |

### DTOs

`CreateDebtDto`:
```ts
{
  direction: 'lent' | 'borrowed';     // @IsIn
  counterpartyName: string;           // @IsString @MinLength(1) @MaxLength(100)
  principal: number;                  // @IsInt @Min(1)
  fundId: string;                     // @IsUUID
  openedAt?: string;                  // @IsISO8601 (optional, default now)
  note?: string;                      // @MaxLength(500)
}
```

`RecordPaymentDto`:
```ts
{
  amount: number;                     // @IsInt @Min(1)
  paidAt?: string;                    // @IsISO8601
  note?: string;
}
```

### View types

```ts
type DebtView = {
  id: string;
  direction: 'lent' | 'borrowed';
  counterpartyName: string;
  principal: number;
  remainingAmount: number;
  paidAmount: number;          // = principal - remainingAmount, derived
  status: 'open' | 'settled';
  fundId: string;
  fundName: string;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
};

type DebtPaymentView = {
  id: string;
  kind: 'open' | 'repayment';
  amount: number;
  transactionId: string;
  paidAt: string;
  note: string | null;
};
```

### Service responsibilities

`DebtsService`:

- `listForUser(user, { status, direction })` — join `fundId IN visibleFundIds(user)`.
- `findByIdForUser(user, debtId)` — 404 nếu không tồn tại hoặc fund không visible.
- `summaryForUser(user)` — group sum `remainingAmount` theo direction, status=open.
- `createDebt(input, user)` — DB transaction:
  1. Validate fund visible + writable (`fund.type === 'joint' || fund.ownerId === user.id`).
  2. Resolve default category ("Cho vay") — qua `CategoriesService`.
  3. Gọi `transactionsService.createInternal({ fundId, userId, amount: sign*principal, categoryId, note, date: openedAt, source: 'chat'|'form' })` — method internal mới (xem dưới).
  4. Insert Debt + DebtPayment(kind='open').
- `recordPayment(debtId, input, user)` — DB transaction:
  1. Load debt, validate visible + status='open'.
  2. Validate `0 < amount <= remainingAmount`.
  3. Sign = `direction === 'lent' ? +amount : -amount`.
  4. Tạo Transaction (category "Trả nợ").
  5. `debt.remainingAmount -= amount`. Nếu = 0 → status='settled', closedAt=now.
  6. Insert DebtPayment(kind='repayment').
- `deletePayment(debtId, paymentId, user)`:
  1. Load + validate ownership.
  2. Xoá Transaction (qua `transactionsService.deleteForUser` để balance update đúng).
  3. Xoá DebtPayment.
  4. `debt.remainingAmount += payment.amount`. Nếu trước đó settled → status='open', closedAt=null.
  5. Không cho phép xoá payment có `kind='open'` (phải dùng `deleteDebt` thay thế).
- `deleteDebt(debtId, user)`:
  1. Load + validate ownership.
  2. Loop tất cả DebtPayment, xoá từng Transaction qua `transactionsService.deleteForUser` (đảm bảo balance update).
  3. Xoá Debt (cascade xoá payments).

### Cần thêm trên `TransactionsService`

Method internal mới `createInternal({ fundId, userId, amount, categoryId, note, date, source, rawText? })` — không gọi parser, dùng cho service khác. Nội dung gần giống `createFromAgent` nhưng nhận `fundId/categoryId` trực tiếp thay vì `fundName/categoryName`. Vẫn enforce privacy + update balance.

## Parser tools

### Tools mới trong `apps/api/src/agent/subagents/parser/parser.tools.ts`

```ts
{
  name: 'open_debt',
  description: 'Mở khoản cho vay (lent) hoặc đi vay (borrowed). Sẽ tự tạo transaction cash flow: lent → trừ quỹ; borrowed → cộng quỹ.',
  input_schema: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['lent', 'borrowed'] },
      counterpartyName: { type: 'string', description: 'Tên người/đơn vị: "Hoàng", "VCB", "Mẹ"' },
      amount: { type: 'integer', description: 'VND nguyên, luôn dương' },
      fundName: { type: 'string', description: 'Exact tên quỹ từ context' },
      note: { type: 'string' },
      openedAt: { type: 'string', description: 'ISO date, default now' },
    },
    required: ['direction', 'counterpartyName', 'amount', 'fundName'],
  },
},
{
  name: 'record_debt_payment',
  description: 'Ghi 1 lần trả nợ cho khoản đang mở. debt_id lấy từ context "Khoản nợ đang mở".',
  input_schema: {
    type: 'object',
    properties: {
      debt_id: { type: 'string' },
      amount: { type: 'integer' },
      note: { type: 'string' },
      paidAt: { type: 'string' },
    },
    required: ['debt_id', 'amount'],
  },
}
```

### `ParseAction` types mới

```ts
| { kind: 'debt_opened'; id: string; direction: 'lent' | 'borrowed';
    counterpartyName: string; amount: number; fundName: string }
| { kind: 'debt_payment_recorded'; debtId: string; amount: number;
    remainingAmount: number; settled: boolean; counterpartyName: string;
    direction: 'lent' | 'borrowed' }
```

### Context block bổ sung trong `parser.subagent.ts`

Thêm section trong `buildContext()` — sau "Giao dịch user vừa log", trước "Ngày quan trọng":

```
### Khoản nợ đang mở (status=open, visible cho user)
  - id=`<uuid>` · CHO Hoàng VAY · còn lại 10.000.000đ / gốc 15.000.000đ · quỹ Chồng · mở 10/05/2026
  - id=`<uuid>` · BẠN VAY VCB · còn lại 100.000.000đ / gốc 100.000.000đ · quỹ Chồng · mở 01/04/2026

> Khi user nói "X trả Y" hoặc "trả X Y" → dùng record_debt_payment với debt_id từ list trên.
> Match counterpartyName case-insensitive, cho phép prefix ("anh Hoàng" match "Hoàng").
> Nếu nhiều khoản với cùng person/entity → gọi ask_clarification.
> Khi user mở khoản mới ("cho X vay Y", "tôi vay X Y") → dùng open_debt.
> Mặc định fundName = quỹ cá nhân của current user khi user không nói rõ quỹ.
```

Giới hạn 10 khoản gần nhất theo `openedAt desc` để giữ prompt gọn.

### Skill prompt updates (`parser/skill.md`)

Thêm section "Khoản vay & cho vay":

- Pattern `cho [X] vay [N]`, `cho [X] mượn [N]`, `[X] mượn [N] của tôi` → `open_debt(direction='lent')`.
- Pattern `tôi vay [X] [N]`, `mượn [X] [N]`, `vay [X] [N]` → `open_debt(direction='borrowed')`.
- Pattern `[X] trả [N]` (khi có lent debt với X) → `record_debt_payment`.
- Pattern `trả [X] [N]` (khi có borrowed debt với X) → `record_debt_payment`.
- Pattern `trả nợ [X] [N]` (explicit) → `record_debt_payment`.
- Khi ambiguous (nhiều debt cùng tên, hoặc verb có thể là expense bình thường) → `ask_clarification`.

### Handler trong `parser.subagent.ts handleResponse()`

Thêm 2 nhánh `else if (block.name === 'open_debt')` và `else if (block.name === 'record_debt_payment')` — gọi `debtsService.createFromAgent(...)` và `debtsService.recordPaymentFromAgent(...)`. Bắt error → push `tool_error`. Pattern y hệt các tool đã có.

### `synthesizeReply` thêm format

- `💸 Đã ghi cho Hoàng vay 15.000.000đ • Quỹ Chồng`
- `📥 Đã ghi vay VCB 100.000.000đ • Quỹ Chồng`
- `✅ Hoàng trả 5.000.000đ • còn 10.000.000đ`
- `🎉 Đã trả hết! Khoản vay VCB đã đóng.`

### Inject Debts module vào AgentModule

`AgentModule` import `DebtsModule`. `ParserSubagent` inject `DebtsService` + repo `Debt` cho context query.

## UI

### Page `/debts`

`apps/web/app/(app)/debts/page.tsx` — server component fetch initial data, pass xuống client wrapper.

### Feature slice `apps/web/features/debts/`

```
api.ts             — listDebts, getSummary, createDebt, recordPayment, deletePayment, deleteDebt
types.ts           — DebtView, DebtPaymentView, DebtSummary
components/
  DebtsPageClient.tsx
  DebtsSummaryCards.tsx
  DebtsList.tsx
  DebtCard.tsx
  RecordPaymentDialog.tsx
  CreateDebtDialog.tsx
  DebtDetailDrawer.tsx
```

### Layout

```
┌──────────────────────────────────────────────────┐
│ Nợ & Cho vay                  [+ Tạo khoản mới]  │
├──────────────────────────────────────────────────┤
│ ┌─ Người khác nợ bạn ─┐  ┌─ Bạn nợ người khác ─┐ │
│ │ 25.000.000đ         │  │ 100.000.000đ         │ │
│ │ 2 khoản đang mở     │  │ 1 khoản đang mở      │ │
│ └─────────────────────┘  └──────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [ Cho vay ] [ Đi vay ] [ Đã đóng ]               │
├──────────────────────────────────────────────────┤
│ ▸ Hoàng                                          │
│   Còn 10.000.000đ / 15.000.000đ ▰▰▰▱▱  [Ghi trả]│
│   Quỹ Chồng · mở 10/05/2026                      │
└──────────────────────────────────────────────────┘
```

### Components

- **DebtsSummaryCards**: 2 card hiển thị total + count. Tint nhẹ: cho vay xanh lá, đi vay cam.
- **DebtCard**: counterparty name (lớn), `remaining/principal` + progress bar (paid%), fund name + openedAt nhỏ phía dưới, nút primary "Ghi trả" góc phải. Click vùng ngoài nút → mở detail drawer.
- **RecordPaymentDialog**: input `amount` (integer VND, max=remaining), `note` optional. Hiển thị "Sau khi trả: còn lại Xđ"; nếu `amount === remaining` thêm note "Sẽ đóng khoản này".
- **CreateDebtDialog**: toggle direction, counterparty text, principal integer, fund select (chỉ writable spending funds), note optional.
- **DebtDetailDrawer**: open từ DebtCard. Show debt info + list payments (mỗi payment link tới transaction). Nút "Xoá lần trả này" + "Xoá toàn bộ khoản nợ" (confirm).

### Tabs

3 tabs (default = "Cho vay"):
- "Cho vay" → `?direction=lent&status=open`
- "Đi vay" → `?direction=borrowed&status=open`
- "Đã đóng" → `?direction=all&status=settled`

### Sidebar nav

Thêm link "Nợ & Cho vay" vào sidebar (sau "Giao dịch") — icon Lucide `HandCoins`.

### Style

Theo dark mode palette hiện tại. Cho vay tint xanh lá nhạt; đi vay tint cam nhạt — phân biệt nhanh ở SummaryCards + DebtCard accent.

## Privacy

- Mọi service method (list/get/create/payment/delete) đều enforce qua `visibleFundIds(user)` — debt chỉ visible nếu fund của nó visible.
- Write ops (create, payment, delete) cần fund writable: `fund.type === 'joint' || fund.ownerId === user.id` — nếu không → `ForbiddenException`.
- Subagent context chỉ list debts mà user thấy được (cùng filter).

## Money rules

- `principal`, `remainingAmount`, `amount` đều **bigint VND integer**. Không float.
- Hiển thị: `toLocaleString('vi-VN')` + `đ`. Format số có sign khi trong synthesize.
- Validation: `@IsInt() @Min(1)` cho mọi field tiền (không cho phép 0 hoặc âm khi input).

## Migration

`/db-migrate add-debts` → generate migration tạo 2 bảng `debts` + `debt_payments` với indexes & FKs như spec. Review SQL trước khi `migration:run`.

Seed update: thêm 3 default categories "Cho vay", "Đi vay", "Trả nợ" cho family mới (idempotent — check name trước khi insert).

## Out of scope (defer)

- **Lãi suất / lịch trả góp**: không trong MVP. Khi cần, thêm cột `interestRate`, `interestType` lên Debt + tách `paidPrincipal` vs `paidInterest` trên payment.
- **Edit counterpartyName sau khi tạo**: chưa cho phép — phải xoá + tạo lại.
- **Counterparty entity riêng**: free-text đủ dùng. Khi muốn xem "tổng nợ với Hoàng qua các khoản" có thể aggregate by normalized name client-side.
- **Reminder / due date**: chưa. Có thể tích hợp với `important-dates` sau.
- **Dashboard widget tổng nợ**: defer; trang `/debts` đã đủ.
- **Multi-payment trong 1 lần submit**: defer.

## Testing strategy

Unit/integration tests (Jest, `*.spec.ts` cạnh source):
- `debts.service.spec.ts`:
  - createDebt: lent → transaction âm, fund balance giảm, debt status=open, remaining=principal.
  - createDebt: borrowed → transaction dương, fund balance tăng.
  - recordPayment: partial → remaining giảm; full → status=settled, closedAt set.
  - recordPayment: amount > remaining → 400.
  - deletePayment: revert balance + remaining; nếu đang settled → mở lại.
  - deleteDebt: cascade xoá tất cả transactions, balance recover.
  - Privacy: user A không thấy debt trên quỹ riêng của user B.
- `parser.subagent.spec.ts` (extension): pattern "cho X vay N" gọi `open_debt`; "X trả N" với 1 open lent debt gọi `record_debt_payment`; ambiguous gọi `ask_clarification`.

Manual smoke tests sau khi implement:
- Chat: "cho Hoàng vay 15 triệu" → check Debt row + Transaction row + balance.
- Chat: "Hoàng trả 5 triệu" → check remaining=10tr, transaction +5tr.
- Chat: "Hoàng trả 10 triệu" → check status=settled, closedAt set, total balance correct.
- UI `/debts`: tạo manual, ghi trả, xoá payment, xoá debt — verify balance recover.

## Files cần thêm/sửa (high level)

**Add**:
- `apps/api/src/modules/debts/**` (module + controller + service + entities + dtos)
- `apps/api/src/agent/subagents/parser/parser.tools.ts` — 2 tools mới
- `apps/api/migrations/<timestamp>-add-debts.ts`
- `apps/web/features/debts/**`
- `apps/web/app/(app)/debts/page.tsx`

**Modify**:
- `apps/api/src/app.module.ts` — register `DebtsModule`
- `apps/api/src/data-source.ts` — register entities `Debt`, `DebtPayment`
- `apps/api/src/modules/transactions/transactions.service.ts` — thêm `createInternal(...)` + đảm bảo `deleteForUser` revert balance đúng (đã có hay không cần check khi implement)
- `apps/api/src/modules/transactions/transactions.module.ts` — export service nếu chưa
- `apps/api/src/agent/agent.module.ts` — import `DebtsModule`
- `apps/api/src/agent/subagents/parser/parser.subagent.ts` — context block + 2 handler branches + ParseAction types + synthesizeReply
- `apps/api/src/agent/subagents/parser/skill.md` — pattern section
- `apps/api/src/seed.ts` — thêm 2 categories default
- `apps/web/components/layout/Sidebar.tsx` (hoặc tương đương) — link "Nợ & Cho vay"
