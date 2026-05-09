# Chat → Important Date — design spec

**Date**: 2026-05-09
**Status**: Approved (ready for implementation plan)
**Scope**: Extend chat parser to recognize "important date" intent + 2-step preview/confirm UX. No business logic change to `important-dates` module.

## Mục tiêu

Cho phép user gõ tự nhiên trong chat (vd "sinh nhật vợ 25/12", "giỗ ông 12/3 âm, kỷ niệm 14/2") để parser AI tự nhận diện và đề xuất tạo important date. User confirm trong action card mới thực sự tạo.

## Quyết định đã chốt (brainstorming)

| # | Câu | Quyết định |
|---|-----|-----------|
| 1 | Trigger style | Parser AI tự nhận diện (không cần lệnh prefix) |
| 2 | Confirm UX | Preview card → user click "Xác nhận" mới create |
| 3 | Visibility | Always shared (giữ pattern hiện tại của `important-dates`) |
| 4 | Multi-date trong 1 message | Parser gọi `propose_important_date` N lần → N action card |
| 5 | Reminder default | `[0, 2]` (2 ngày trước + hôm đó) |

## Architecture

**Pattern**: Parser đề xuất (không DB write) → FE render preview card → user confirm → FE call existing `POST /api/important-dates` API trực tiếp → FE mutate action state thành `important_date_logged`.

Không dùng "follow-up message qua chat" pattern vì parser stateless mỗi turn (sẽ phải lưu pending proposal đâu đó). FE-confirm đơn giản, ít touchpoint hơn.

## API changes

### New tool: `propose_important_date` (`parser.tools.ts`)

```ts
{
  name: 'propose_important_date',
  description:
    'Đề xuất tạo 1 ngày quan trọng (sinh nhật / giỗ / kỷ niệm). ' +
    'Đây là PROPOSAL — chưa lưu DB. User sẽ confirm ở FE. ' +
    'Nếu user nói nhiều ngày trong 1 message, gọi tool này NHIỀU LẦN, mỗi lần 1 ngày.',
  input_schema: {
    type: 'object',
    required: ['name', 'type', 'date', 'isLunar', 'remindDaysBefore'],
    properties: {
      name:    { type: 'string', minLength: 1, maxLength: 120 },
      type:    { enum: ['birthday','death_anniversary','anniversary','other'] },
      date:    { type: 'string', description: 'ISO8601 date YYYY-MM-DD' },
      isLunar: { type: 'boolean' },
      remindDaysBefore: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 60 },
        description: 'Default [0, 2] khi propose từ chat',
      },
      notes:   { type: 'string', maxLength: 2000 },
    },
  },
}
```

Type export:
```ts
export interface ProposeImportantDateInput {
  name: string;
  type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
  date: string;
  isLunar: boolean;
  remindDaysBefore: number[];
  notes?: string;
}
```

### Updated `ParseAction` union (`parser.subagent.ts`)

Add 1 new variant. We do NOT add `important_date_logged` to the API union — that state is purely FE-side after confirm. Parser only emits the proposal.

```ts
| {
    kind: 'important_date_proposed';
    name: string;
    type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
    date: string;
    isLunar: boolean;
    remindDaysBefore: number[];
    notes: string | null;
  }
```

### Parser handler (`parser.subagent.ts:handleResponse`)

In the `else if (block.name === ...)` chain, add:
```ts
} else if (block.name === 'propose_important_date') {
  const input = block.input as ProposeImportantDateInput;
  actions.push({
    kind: 'important_date_proposed',
    name: input.name,
    type: input.type,
    date: input.date,
    isLunar: input.isLunar,
    remindDaysBefore: input.remindDaysBefore,
    notes: input.notes ?? null,
  });
}
```

No service call, no try/catch — pure pass-through.

### Skill prompt (`skill.md`)

Add a new section near the top (before transaction rules) titled **"Khi user nói về ngày kỷ niệm / sinh nhật / giỗ"** with:

1. Rule phân biệt:
   - Important date: cụm event ("sinh nhật", "giỗ", "kỷ niệm", "ngày cưới", "đám hỏi") + ngày — KHÔNG có money keyword
   - Transaction: có money (số + k/tr/triệu/đ) hoặc verb tiêu/thu/lương/mua → log_transaction
   - Edge case: "Mua quà sinh nhật vợ 500k" → có money → transaction (bỏ qua intent date)
2. Mapping type:
   - "sinh nhật" → `birthday`
   - "giỗ", "ngày mất", "đám giỗ" → `death_anniversary`
   - "kỷ niệm", "ngày cưới", "đám hỏi" → `anniversary`
   - khác → `other`
3. Lunar detection: nếu thấy "âm", "âm lịch", "ÂL" → `isLunar=true`, ngược lại `false`
4. Date parsing:
   - "25/12" → year hiện tại
   - "25/12/2027" → 2027
   - "12 tháng 3" → DD/MM, năm hiện tại
   - Nếu ngày + tháng đã qua trong năm nay → vẫn dùng năm nay (không auto bump sang năm sau, để user thấy + sửa)
5. Default `remindDaysBefore`: `[0, 2]`
6. **Quan trọng**: nếu user nhập nhiều ngày trong 1 message → gọi `propose_important_date` NHIỀU LẦN, mỗi tool call 1 ngày
7. 4–5 ví dụ đầy đủ:

   **Ví dụ 1** (single):
   - User: "sinh nhật vợ 25/12"
   - Tool: `propose_important_date(name="Sinh nhật vợ", type="birthday", date="2026-12-25", isLunar=false, remindDaysBefore=[0,2])`

   **Ví dụ 2** (lunar):
   - User: "giỗ bố 12/3 âm"
   - Tool: `propose_important_date(name="Giỗ bố", type="death_anniversary", date="2026-03-12", isLunar=true, remindDaysBefore=[0,2])`

   **Ví dụ 3** (multi):
   - User: "sinh nhật vợ 25/12, kỷ niệm 14/2"
   - Tool call 1: `propose_important_date(name="Sinh nhật vợ", type="birthday", date="2026-12-25", isLunar=false, remindDaysBefore=[0,2])`
   - Tool call 2: `propose_important_date(name="Kỷ niệm", type="anniversary", date="2026-02-14", isLunar=false, remindDaysBefore=[0,2])`

   **Ví dụ 4** (edge — money có mặt):
   - User: "mua quà sinh nhật vợ 500k"
   - → log_transaction (vì có "500k") — KHÔNG đề xuất important date

   **Ví dụ 5** (clarify):
   - User: "sinh nhật vợ"
   - → ask_clarification("Sinh nhật vợ vào ngày nào?")

## Web changes

### `apps/web/features/chat/types.ts`

Mirror backend: add `important_date_proposed` variant. Add a FE-only `important_date_logged` variant (used after FE-side confirm).

```ts
export type ParseAction =
  | { kind: 'logged'; ... }
  | { kind: 'updated'; ... }
  | { kind: 'deleted'; id: string }
  | { kind: 'clarify'; question: string }
  | { kind: 'category_created'; ... }
  | { kind: 'tool_error'; ... }
  | {
      kind: 'important_date_proposed';
      name: string;
      type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
      date: string;
      isLunar: boolean;
      remindDaysBefore: number[];
      notes: string | null;
    }
  | {
      kind: 'important_date_logged';
      id: string;
      name: string;
      date: string;
      type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
    }
  | {
      kind: 'important_date_dismissed';
    };
```

`important_date_dismissed` for "Bỏ qua" state — keeps card mounted with "Đã bỏ qua" hint instead of unmounting (cleaner than removing from messages array).

### `apps/web/app/(authed)/chat/page.tsx` — `ActionCard`

Add render branches for `important_date_proposed`, `important_date_logged`, `important_date_dismissed`.

For `important_date_proposed`: render card with:
- Title with type icon (🎂 birthday, 🕯 death_anniversary, 💑 anniversary, 📅 other)
- Name + formatted date (vi-VN locale, "25/12/2026" or "12/3 âm lịch")
- Reminder summary ("Nhắc trước 2 ngày + hôm đó")
- 2 buttons: **"Xác nhận"** (emerald primary) + **"Bỏ qua"** (stone secondary)

The card needs **mutable state** to track confirm/dismiss outcome. Solution: lift the action's state into the parent message — replace the action object in the `messages[].actions[]` array when user clicks. Concretely:

```ts
function ActionCard({ action, messageId, actionIndex, onMutate }: {
  action: ParseAction;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) { ... }
```

Parent passes `onMutate` from page-level state. On confirm:
1. Call `createImportantDate({ name, type, date, isLunar, remindDaysBefore, notes: notes ?? '' })`
2. On success: `onMutate(msgId, idx, { kind: 'important_date_logged', id: result.id, ... })`
3. On error: show inline error in the card, keep `important_date_proposed` state

On dismiss: `onMutate(msgId, idx, { kind: 'important_date_dismissed' })`

### Page-level state for action mutation

In `ChatPage` we already have `setMessages`. Add:
```ts
const mutateAction = (msgId: string, actIdx: number, next: ParseAction) => {
  setMessages((ms) =>
    ms.map((m) =>
      m.id !== msgId
        ? m
        : {
            ...m,
            actions: m.actions?.map((a, i) => (i === actIdx ? next : a)),
          },
    ),
  );
};
```

Pass `mutateAction` down to `MessageBubble` → `ActionCard`.

**Persistence concern**: when user reloads page, `listChatMessages` returns historical actions stored in DB. Important-date actions stored as `important_date_proposed` would re-render confirm UI even after user already confirmed. Mitigation:
- Keep simple for MVP: action is FE-mutated only — reload restores proposed state. User would see "Xác nhận" again. Click confirm 2nd time → API may succeed and create duplicate.
- **Real fix** (in scope): when calling create, check if backend stores chat actions in DB. Look at `chatMessage.actions` — if persisted as JSONB column, FE mutation isn't saved.

To be safe, FE should:
- Track confirm state in `localStorage` keyed by `messageId+actionIndex` so reload preserves it
- OR persist a chat-message status update via API after confirm

For MVP simplicity: **localStorage** key `concord_imp_date_confirmed_<msgId>_<idx>` set when confirmed, `concord_imp_date_dismissed_<msgId>_<idx>` set when dismissed. On render, check localStorage; if confirmed, render `important_date_logged` (no id known after reload — could just show "Đã thêm"); if dismissed, render dismissed state.

This is light-weight and ships cleanly. Backend persistence of action confirm-state is a future refinement.

## Out of scope

- Edit / update important date from chat (use UI form)
- Delete from chat
- Per-user visibility of important dates (kept shared)
- Backend persistence of confirm/dismiss state (FE localStorage only, see Persistence concern above)
- "Confirm all" button when N cards proposed (each confirmed individually)
- Lunar date validation (BE accepts as-is)

## Files affected

**API (3):**
- `apps/api/src/agent/subagents/parser/parser.tools.ts` — add tool def + input type export
- `apps/api/src/agent/subagents/parser/parser.subagent.ts` — extend `ParseAction` + `handleResponse` block
- `apps/api/src/agent/subagents/parser/skill.md` — add section + 5 examples

**Web (2):**
- `apps/web/features/chat/types.ts` — extend `ParseAction` union
- `apps/web/app/(authed)/chat/page.tsx` — `ActionCard` render branches + `mutateAction` plumbing + localStorage persistence helper

**Not touched:**
- `apps/api/src/modules/important-dates/*` — existing `create()` is sufficient
- `apps/web/features/important-dates/api.ts` — existing `createImportantDate()` reused
- `apps/web/features/important-dates/types.ts`
- DB schema — no changes

## Acceptance criteria

1. User gõ "sinh nhật vợ 25/12" → 1 preview card hiển thị với name "Sinh nhật vợ", type 🎂, date 25/12/2026, reminder "2 ngày trước + hôm đó", 2 buttons.
2. Click "Xác nhận" → API call create thành công → card đổi thành state "Đã thêm: Sinh nhật vợ" (no buttons).
3. Click "Bỏ qua" → card chuyển thành state "Đã bỏ qua".
4. Reload page → card vẫn ở state confirmed/dismissed (localStorage persist).
5. User gõ "sinh nhật vợ 25/12, kỷ niệm 14/2" → 2 cards riêng biệt.
6. User gõ "mua quà sinh nhật vợ 500k" → log_transaction (KHÔNG propose important date).
7. User gõ "giỗ bố 12/3 âm" → preview với `isLunar=true`.
8. Lint + tsc pass cho cả `api` + `web`.
