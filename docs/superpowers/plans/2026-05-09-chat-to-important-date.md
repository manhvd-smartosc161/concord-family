# Chat → Important Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the chat parser so users can type natural messages like "sinh nhật vợ 25/12" or multi-date messages "sinh nhật vợ 25/12, kỷ niệm 14/2" and have them turn into preview cards in chat that user confirms to create important-date entries via the existing `POST /api/important-dates` endpoint.

**Architecture:** Parser proposes (no DB write) → FE renders preview card with Confirm/Dismiss buttons → on Confirm, FE calls existing `createImportantDate()` API directly → on success, action mutates to `important_date_logged` state → state persists across reloads via `localStorage` keyed by message+action index.

**Tech Stack:** NestJS 11 + Anthropic SDK (Haiku 4.5 parser) · Next.js 16 + React 19 + Tailwind v4 · TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-09-chat-to-important-date.md](../specs/2026-05-09-chat-to-important-date.md)

---

## File structure

**Modified (5):**

API:
- `apps/api/src/agent/subagents/parser/parser.tools.ts` — add `proposeImportantDateTool` Anthropic.Tool, add to `parserTools` array, export `ProposeImportantDateInput` type
- `apps/api/src/agent/subagents/parser/parser.subagent.ts` — extend `ParseAction` union with `important_date_proposed`, add `else if (block.name === 'propose_important_date')` branch in `handleResponse`
- `apps/api/src/agent/subagents/parser/skill.md` — prepend a new section "🎂 Khi user nói về ngày kỷ niệm / sinh nhật / giỗ" with rules + 5 worked examples

Web:
- `apps/web/features/chat/types.ts` — extend `ParseAction` union with 3 new variants (`important_date_proposed`, `important_date_logged`, `important_date_dismissed`)
- `apps/web/app/(authed)/chat/page.tsx` — extend `ActionCard` render with proposed/logged/dismissed branches, plumb `messageId`/`actionIndex`/`onMutate` from page through `MessageBubble`, add page-level `mutateAction` + `localStorage` rehydration on message load

**NOT touched:**
- `apps/api/src/modules/important-dates/*`
- `apps/web/features/important-dates/api.ts` (reuse `createImportantDate`)
- `apps/web/features/important-dates/types.ts`
- DB schema, migrations

---

## Verification approach

For each task:
1. **Lint**: `pnpm --filter <api|web> lint` must pass
2. **Type check**: `pnpm --filter api build` (clean tsc) for api side, `cd apps/web && npx tsc --noEmit` for web side
3. **Manual smoke** at the very end (Task 6) — start dev server, type test messages, verify cards render and confirm flow works

`pnpm --filter web build` (full Next build) is broken by a pre-existing prerender bug (`/important-dates/year` + `/_global-error`) and is OUT OF SCOPE — do NOT run it. Use `tsc --noEmit` for web type-checking.

---

## Task 0: Verify baseline

**Files:** none

- [ ] **Step 1: Verify clean working tree**

```bash
cd /Users/manhvd/Desktop/concord
git status
```

Expected: clean tree.

- [ ] **Step 2: Verify api lint + build pass**

```bash
pnpm --filter api lint
pnpm --filter api build
```

Both must pass. If they don't, stop and fix before continuing.

- [ ] **Step 3: Verify web lint + tsc pass**

```bash
pnpm --filter web lint
cd apps/web && npx tsc --noEmit
```

Both must produce no errors.

---

## Task 1: API — add `propose_important_date` tool

**Files:**
- Modify: `apps/api/src/agent/subagents/parser/parser.tools.ts`

- [ ] **Step 1: Add tool definition**

Open `apps/api/src/agent/subagents/parser/parser.tools.ts`. After `createCategoryTool` definition (around line 147) and BEFORE `parserTools` array, add:

```ts
export const proposeImportantDateTool: Anthropic.Tool = {
  name: 'propose_important_date',
  description:
    'Đề xuất tạo 1 ngày quan trọng (sinh nhật / giỗ / kỷ niệm). ' +
    'Đây là PROPOSAL — chưa lưu DB. User sẽ confirm ở FE. ' +
    'Nếu user nói NHIỀU ngày trong 1 message, gọi tool này NHIỀU LẦN, mỗi lần 1 ngày.',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Tên ngày, tiếng Việt, ≤120 chars. Vd: "Sinh nhật vợ", "Giỗ bố", "Kỷ niệm cưới".',
      },
      type: {
        type: 'string',
        enum: ['birthday', 'death_anniversary', 'anniversary', 'other'],
        description:
          '"birthday" cho sinh nhật, "death_anniversary" cho giỗ/ngày mất, ' +
          '"anniversary" cho kỷ niệm/ngày cưới/đám hỏi, "other" cho các loại khác.',
      },
      date: {
        type: 'string',
        description:
          'Ngày, định dạng ISO 8601 YYYY-MM-DD (vd "2026-12-25"). Lấy năm hiện tại nếu user không nói rõ.',
      },
      isLunar: {
        type: 'boolean',
        description:
          'true nếu user nói "âm", "âm lịch", "ÂL". false nếu dương lịch hoặc không rõ.',
      },
      remindDaysBefore: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 60 },
        description:
          'Mảng số ngày nhắc trước (0 = hôm đó). MẶC ĐỊNH dùng [0, 2] khi propose từ chat.',
      },
      notes: {
        type: 'string',
        description: 'Ghi chú tuỳ chọn (≤2000 chars). Bỏ trống nếu user không nói.',
      },
    },
    required: ['name', 'type', 'date', 'isLunar', 'remindDaysBefore'],
  },
};
```

- [ ] **Step 2: Add to `parserTools` array**

Replace the existing `parserTools` array (around line 149):

```ts
export const parserTools: Anthropic.Tool[] = [
  logTransactionTool,
  askClarificationTool,
  updateTransactionTool,
  deleteTransactionTool,
  createCategoryTool,
  proposeImportantDateTool,
];
```

- [ ] **Step 3: Add input type at the bottom of the file**

After `CreateCategoryInput` interface (last existing interface around line 188), append:

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

- [ ] **Step 4: Verify lint + build**

```bash
cd /Users/manhvd/Desktop/concord
pnpm --filter api lint
pnpm --filter api build
```

Both must pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/subagents/parser/parser.tools.ts
git commit -m "feat(api): add propose_important_date parser tool"
```

---

## Task 2: API — handle `propose_important_date` in subagent

**Files:**
- Modify: `apps/api/src/agent/subagents/parser/parser.subagent.ts`

- [ ] **Step 1: Extend imports**

Open `apps/api/src/agent/subagents/parser/parser.subagent.ts`. The existing import block from `./parser.tools` is around lines 13-20:

```ts
import {
  AskClarificationInput,
  CreateCategoryInput,
  DeleteTransactionInput,
  LogTransactionInput,
  UpdateTransactionInput,
  parserTools,
} from './parser.tools';
```

Add `ProposeImportantDateInput`:

```ts
import {
  AskClarificationInput,
  CreateCategoryInput,
  DeleteTransactionInput,
  LogTransactionInput,
  ProposeImportantDateInput,
  UpdateTransactionInput,
  parserTools,
} from './parser.tools';
```

- [ ] **Step 2: Extend `ParseAction` union**

The `ParseAction` union starts at line 22. Add a new variant at the END of the union (before the closing `;`):

```ts
export type ParseAction =
  | {
      kind: 'logged';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
      balance: number;
    }
  | {
      kind: 'updated';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
    }
  | { kind: 'deleted'; id: string }
  | { kind: 'clarify'; question: string }
  | {
      kind: 'category_created';
      name: string;
      isEssential: boolean;
      parentName: string | null;
    }
  | { kind: 'tool_error'; toolName: string; message: string }
  | {
      kind: 'important_date_proposed';
      name: string;
      type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
      date: string;
      isLunar: boolean;
      remindDaysBefore: number[];
      notes: string | null;
    };
```

- [ ] **Step 3: Add handler block in `handleResponse`**

In `handleResponse` (around line 191), there is a chain of `else if (block.name === ...)` branches handling each tool. The chain ends near line 290+ before a `default`/error branch. Find the LAST `else if` block (likely `create_category`) and AFTER it (before any closing `}` for the loop), add:

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

This is a pure pass-through — no service call, no try/catch, no DB write. The actual DB create happens FE-side after user confirms.

- [ ] **Step 4: Verify lint + build**

```bash
pnpm --filter api lint
pnpm --filter api build
```

Both must pass. Pay attention to TS errors — exhaustiveness checks elsewhere in the codebase may need update if any switch on `ParseAction.kind` exists. If you see a TS error like "Type ... is not assignable to type 'never'", search the codebase for `kind:` or `action.kind` exhaustive checks and add the new case (most likely no other switch exists; this would be in `parser.subagent.ts` only).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/subagents/parser/parser.subagent.ts
git commit -m "feat(api): emit important_date_proposed action from parser"
```

---

## Task 3: API — update `skill.md` parser prompt

**Files:**
- Modify: `apps/api/src/agent/subagents/parser/skill.md`

- [ ] **Step 1: Read the current skill.md to find a sensible insertion point**

```bash
head -60 apps/api/src/agent/subagents/parser/skill.md
```

The skill is laid out as: identity / responsibility → semantic rules for transactions → tool reference → examples. The new section should be added near the top, AFTER the identity/responsibility intro but BEFORE the transaction semantic rules. Look for a clear delimiter like a `## ` heading near the top.

- [ ] **Step 2: Insert new section**

Insert the following section into `apps/api/src/agent/subagents/parser/skill.md` AFTER the identity/intro but BEFORE the first `## ` section about transactions/funds. If the file structure is:

```
# Identity (intro)
... text ...
## (some transactions section)
```

Insert your new section as `## 🎂 Khi user nói về ngày kỷ niệm / sinh nhật / giỗ` right before the transactions section.

The section content (paste verbatim):

````markdown
## 🎂 Khi user nói về ngày kỷ niệm / sinh nhật / giỗ

Trước khi quyết định log_transaction hay propose_important_date, áp dụng rule phân biệt sau:

### Rule phân biệt

- **Important date** (gọi `propose_important_date`): cụm từ event ("sinh nhật", "giỗ", "kỷ niệm", "ngày cưới", "đám hỏi", "đám giỗ", "ngày mất") + ngày — và **KHÔNG có money keyword**.
- **Transaction** (gọi `log_transaction`): có money keyword (số kèm "k", "tr", "triệu", "đ", "vnd") hoặc verb tiêu/thu/lương/mua/đổ/trả.
- **Edge case**: "Mua quà sinh nhật vợ 500k" → CÓ "500k" → log_transaction (không propose date). Money thắng.

### Mapping `type`

| Keyword | type |
|---------|------|
| "sinh nhật" | `birthday` |
| "giỗ", "ngày mất", "đám giỗ" | `death_anniversary` |
| "kỷ niệm", "ngày cưới", "đám hỏi" | `anniversary` |
| khác | `other` |

### `isLunar` detection

Set `true` nếu thấy "âm", "âm lịch", "ÂL" trong message. Mặc định `false`.

### Date parsing

- "25/12" → năm hiện tại (xem `Now` trong context)
- "25/12/2027" → 2027
- "12 tháng 3" → DD=12, MM=3, năm hiện tại
- Nếu ngày DD/MM đã qua trong năm nay → vẫn dùng **năm hiện tại** (không tự động bump sang năm sau — user sẽ thấy date và tự sửa nếu muốn)

### Default `remindDaysBefore`

Khi propose từ chat, LUÔN dùng `[0, 2]` (2 ngày trước + hôm đó). User có thể edit sau qua UI.

### ⚠️ Multi-date trong 1 message

Nếu user nhập nhiều ngày trong cùng 1 message, gọi `propose_important_date` **NHIỀU LẦN**, MỖI tool call cho 1 ngày. KHÔNG gộp nhiều ngày vào 1 call.

### Ví dụ

**Ví dụ 1** (single date):
- User: "sinh nhật vợ 25/12"
- Tool call: `propose_important_date(name="Sinh nhật vợ", type="birthday", date="<năm hiện tại>-12-25", isLunar=false, remindDaysBefore=[0, 2])`

**Ví dụ 2** (lunar date):
- User: "giỗ bố 12/3 âm"
- Tool call: `propose_important_date(name="Giỗ bố", type="death_anniversary", date="<năm hiện tại>-03-12", isLunar=true, remindDaysBefore=[0, 2])`

**Ví dụ 3** (multi-date):
- User: "sinh nhật vợ 25/12, kỷ niệm 14/2"
- Tool call 1: `propose_important_date(name="Sinh nhật vợ", type="birthday", date="<năm hiện tại>-12-25", isLunar=false, remindDaysBefore=[0, 2])`
- Tool call 2: `propose_important_date(name="Kỷ niệm", type="anniversary", date="<năm hiện tại>-02-14", isLunar=false, remindDaysBefore=[0, 2])`

**Ví dụ 4** (edge — money có mặt → bỏ qua intent date):
- User: "mua quà sinh nhật vợ 500k"
- Tool call: `log_transaction(...)` — KHÔNG propose important date.

**Ví dụ 5** (thiếu ngày → clarify):
- User: "sinh nhật vợ"
- Tool call: `ask_clarification(question="Sinh nhật vợ vào ngày nào?")`

````

- [ ] **Step 3: Verify lint (unused — skill.md is text not code)**

```bash
pnpm --filter api lint
```

Just a sanity check; should pass since no .ts changed.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/agent/subagents/parser/skill.md
git commit -m "feat(api): teach parser to detect important-date intent"
```

---

## Task 4: Web — extend `ParseAction` union

**Files:**
- Modify: `apps/web/features/chat/types.ts`

- [ ] **Step 1: Replace `ParseAction` union**

Open `apps/web/features/chat/types.ts`. Replace the entire `ParseAction` type (lines 1-20) with:

```ts
export type ParseAction =
  | {
      kind: 'logged';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
      balance: number;
    }
  | {
      kind: 'updated';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
    }
  | { kind: 'deleted'; id: string }
  | { kind: 'clarify'; question: string }
  | {
      kind: 'category_created';
      name: string;
      isEssential: boolean;
      parentName: string | null;
    }
  | { kind: 'tool_error'; toolName: string; message: string }
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
  | { kind: 'important_date_dismissed' };
```

The 3 new variants:
- `important_date_proposed` — emitted by API
- `important_date_logged` — FE-only, after user confirms (carries `id` from `createImportantDate` response)
- `important_date_dismissed` — FE-only, after user dismisses

- [ ] **Step 2: Verify lint + tsc**

```bash
cd /Users/manhvd/Desktop/concord
pnpm --filter web lint
cd apps/web && npx tsc --noEmit
```

Expect tsc errors in `app/(authed)/chat/page.tsx` because `ActionCard` does an exhaustive `kind` check via if/else and now has unhandled cases. That's expected — we'll fix in Task 5. Note the errors but proceed.

- [ ] **Step 3: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/web/features/chat/types.ts
git commit -m "feat(web): add important-date action variants to ParseAction"
```

---

## Task 5: Web — `ActionCard` render + mutation plumbing + localStorage

**Files:**
- Modify: `apps/web/app/(authed)/chat/page.tsx`

This is the largest task. Read the file area around lines 30-160 (top), 330-360 (where `<MessageBubble>` is rendered with mapping), 817-880 (`MessageBubble` definition), 883-962 (`ActionCard` definition).

- [ ] **Step 1: Add localStorage helpers + import for `createImportantDate`**

Near the top of the file imports (after the existing `import` from `@/features/chat/api`), add:

```ts
import { createImportantDate } from '@/features/important-dates/api';
```

Below all imports and before any other code, add the helper functions:

```ts
type ImportantDateConfirmState =
  | { kind: 'confirmed'; id: string; loggedAt: string }
  | { kind: 'dismissed' };

function loadImportantDateState(
  msgId: string,
  actIdx: number,
): ImportantDateConfirmState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(`concord_imp_date_${msgId}_${actIdx}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImportantDateConfirmState;
  } catch {
    return null;
  }
}

function saveImportantDateState(
  msgId: string,
  actIdx: number,
  state: ImportantDateConfirmState,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `concord_imp_date_${msgId}_${actIdx}`,
    JSON.stringify(state),
  );
}
```

- [ ] **Step 2: Add `mutateAction` callback + rehydrate logic in `ChatPage`**

Inside the `ChatPage` function body, after `const [messages, setMessages] = useState<PendingMessage[]>([]);`, add the mutation callback:

```ts
const mutateAction = useCallback(
  (msgId: string, actIdx: number, next: ParseAction) => {
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
  },
  [],
);
```

Find the `useEffect` that loads messages from `listChatMessages(sessionIdFromUrl)` (around lines 101-137). After `setMessages(...)` is called inside `.then(...)`, the message actions need rehydration from localStorage. Update the `setMessages` call to apply rehydration:

Currently:
```ts
.then((msgs) => {
  setMessages(
    msgs.map(
      (m): PendingMessage => ({
        id: m.id,
        role: m.role,
        text: m.text,
        actions: m.actions ?? undefined,
        usage: m.usage ?? undefined,
        author: m.author,
      }),
    ),
  );
})
```

Replace with:
```ts
.then((msgs) => {
  setMessages(
    msgs.map(
      (m): PendingMessage => ({
        id: m.id,
        role: m.role,
        text: m.text,
        actions: m.actions
          ? m.actions.map((a, idx) => rehydrateAction(m.id, idx, a))
          : undefined,
        usage: m.usage ?? undefined,
        author: m.author,
      }),
    ),
  );
})
```

And add the helper function above `ChatPage` function (or alongside the localStorage helpers added in Step 1):

```ts
function rehydrateAction(
  msgId: string,
  actIdx: number,
  action: ParseAction,
): ParseAction {
  if (action.kind !== 'important_date_proposed') return action;
  const state = loadImportantDateState(msgId, actIdx);
  if (!state) return action;
  if (state.kind === 'confirmed') {
    return {
      kind: 'important_date_logged',
      id: state.id,
      name: action.name,
      date: action.date,
      type: action.type,
    };
  }
  return { kind: 'important_date_dismissed' };
}
```

- [ ] **Step 3: Plumb `mutateAction` through `MessageBubble` to `ActionCard`**

Update `MessageBubble` signature (around line 817) — add `onMutate` prop:

```ts
function MessageBubble({
  msg,
  showAuthor,
  currentUserId,
  onMutate,
}: {
  msg: PendingMessage;
  showAuthor: boolean;
  currentUserId: string;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
```

Inside `MessageBubble`, find the `msg.actions.map` block (around lines 866-869):

```ts
{msg.actions.map((a, i) => (
  <ActionCard key={i} action={a} />
))}
```

Replace with:
```ts
{msg.actions.map((a, i) => (
  <ActionCard
    key={i}
    action={a}
    messageId={msg.id}
    actionIndex={i}
    onMutate={onMutate}
  />
))}
```

Now find where `<MessageBubble ... />` is rendered (around line 337) and pass `onMutate={mutateAction}`:

```tsx
<MessageBubble
  msg={msg}
  showAuthor={showAuthor}
  currentUserId={user.id}
  onMutate={mutateAction}
/>
```

(Read the existing JSX to get the exact existing prop list — keep all existing props, just add `onMutate={mutateAction}`.)

- [ ] **Step 4: Update `ActionCard` signature and add 3 new render branches**

Replace the entire `ActionCard` function (starting at line 883) with:

```tsx
function ActionCard({
  action,
  messageId,
  actionIndex,
  onMutate,
}: {
  action: ParseAction;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  if (action.kind === 'logged') {
    const isExpense = action.amount < 0;
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          isExpense
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        <div className="font-mono font-semibold tabular-nums">
          {formatVND(action.amount, true)}
        </div>
        <div className="mt-0.5 text-[11px] opacity-80">
          {action.fundName}
          {action.categoryName ? ` • ${action.categoryName}` : ''} · Số dư mới{' '}
          <span className="font-mono tabular-nums">
            {formatVND(action.balance)}
          </span>
        </div>
      </div>
    );
  }
  if (action.kind === 'updated') {
    const isExpense = action.amount < 0;
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          isExpense
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-sky-200 bg-sky-50 text-sky-900'
        }`}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          🔧 <span>Đã sửa</span>
        </div>
        <div className="font-mono font-semibold tabular-nums">
          {formatVND(action.amount, true)}
        </div>
        <div className="mt-0.5 text-[11px] opacity-80">
          {action.fundName}
          {action.categoryName ? ` • ${action.categoryName}` : ''}
        </div>
      </div>
    );
  }
  if (action.kind === 'deleted') {
    return (
      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
        🗑️ Đã xoá giao dịch
      </div>
    );
  }
  if (action.kind === 'clarify') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        ❓ {action.question}
      </div>
    );
  }
  if (action.kind === 'category_created') {
    return (
      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
        <span className="font-medium">✨ Đã tạo category: {action.name}</span>
        <span>
          {action.parentName
            ? ` (thuộc ${action.parentName})`
            : ' (danh mục cha)'}
        </span>
        <span className="text-stone-500">
          {' '}
          — {action.isEssential ? 'thiết yếu' : 'không thiết yếu'}
        </span>
      </div>
    );
  }
  if (action.kind === 'important_date_proposed') {
    return (
      <ImportantDateProposedCard
        action={action}
        messageId={messageId}
        actionIndex={actionIndex}
        onMutate={onMutate}
      />
    );
  }
  if (action.kind === 'important_date_logged') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        ✅ Đã thêm: <span className="font-medium">{action.name}</span>
        <span className="ml-1 text-stone-500">
          — {formatImportantDate(action.date)}
        </span>
      </div>
    );
  }
  if (action.kind === 'important_date_dismissed') {
    return (
      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
        ⊘ Đã bỏ qua đề xuất ngày
      </div>
    );
  }
  if (action.kind === 'tool_error') {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
        ⚠️ {action.message}
      </div>
    );
  }
  return null;
}
```

(Note: the previous code had a fallthrough `return` at the end that assumed `action.message` exists — that was the `tool_error` branch. The new code makes `tool_error` explicit and returns `null` at the end for exhaustiveness.)

- [ ] **Step 5: Add `ImportantDateProposedCard` component + helpers**

Right after the `ActionCard` function (anywhere below it in the file, before the closing `}` of the file), add:

```tsx
function ImportantDateProposedCard({
  action,
  messageId,
  actionIndex,
  onMutate,
}: {
  action: Extract<ParseAction, { kind: 'important_date_proposed' }>;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const icon = importantDateIcon(action.type);
  const dateLabel = formatImportantDate(action.date, action.isLunar);
  const reminderLabel = formatReminderDays(action.remindDaysBefore);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createImportantDate({
        name: action.name,
        type: action.type,
        date: action.date,
        isLunar: action.isLunar,
        remindDaysBefore: action.remindDaysBefore,
        notes: action.notes ?? undefined,
      });
      saveImportantDateState(messageId, actionIndex, {
        kind: 'confirmed',
        id: created.id,
        loggedAt: new Date().toISOString(),
      });
      onMutate(messageId, actionIndex, {
        kind: 'important_date_logged',
        id: created.id,
        name: created.name,
        date: created.date,
        type: created.type,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismiss() {
    saveImportantDateState(messageId, actionIndex, { kind: 'dismissed' });
    onMutate(messageId, actionIndex, { kind: 'important_date_dismissed' });
  }

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
      <div className="flex items-center gap-1.5 font-semibold">
        {icon} <span>Đề xuất ngày quan trọng</span>
      </div>
      <div className="mt-1 font-medium text-stone-800">{action.name}</div>
      <div className="mt-0.5 text-[11px] text-stone-600">
        {dateLabel}
        {action.notes ? ` · ${action.notes}` : ''}
      </div>
      <div className="mt-0.5 text-[11px] text-stone-500">
        Nhắc: {reminderLabel}
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] text-rose-700">⚠️ {error}</div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Đang lưu…' : 'Xác nhận'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={submitting}
          className="rounded-md border border-stone-300 bg-white px-3 py-1 text-[11px] text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
}

function importantDateIcon(
  type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other',
): string {
  switch (type) {
    case 'birthday':
      return '🎂';
    case 'death_anniversary':
      return '🕯';
    case 'anniversary':
      return '💑';
    default:
      return '📅';
  }
}

function formatImportantDate(iso: string, isLunar = false): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const formatted = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
  return isLunar ? `${formatted} (âm)` : formatted;
}

function formatReminderDays(days: number[]): string {
  if (days.length === 0) return 'không nhắc';
  const labels = days.map((d) => (d === 0 ? 'hôm đó' : `${d} ngày trước`));
  return labels.join(' + ');
}
```

- [ ] **Step 6: Verify lint + tsc**

```bash
cd /Users/manhvd/Desktop/concord
pnpm --filter web lint
cd apps/web && npx tsc --noEmit
```

Both must produce no errors.

If tsc complains about `useState` or `useCallback` not imported, add to existing `react` import at top:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

(Most of these are likely already imported; verify and only add the missing ones.)

If tsc complains about `ApiError` not imported, the existing chat page already imports it from `@/lib/api-client`. Just confirm.

- [ ] **Step 7: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/web/app/\(authed\)/chat/page.tsx
git commit -m "feat(web): render important-date proposal cards with confirm/dismiss"
```

---

## Task 6: Manual smoke test (controller / user)

**Files:** none (verification)

This task is performed manually — the model can't drive a browser. Run through these scenarios:

- [ ] **Scenario 1: Single date**

1. Start dev: `pnpm --filter api start:dev` and `pnpm --filter web dev` (in separate terminals).
2. Login at http://localhost:3000.
3. Open chat. Pick any fund.
4. Type: `sinh nhật vợ 25/12`.
5. Expect: 1 sky-colored card appears with title "Đề xuất ngày quan trọng", icon 🎂, name "Sinh nhật vợ", date "25/12/<current year>", reminder "2 ngày trước + hôm đó", and 2 buttons "Xác nhận" / "Bỏ qua".

- [ ] **Scenario 2: Confirm**

Click "Xác nhận" on the card. Expect:
- Button shows "Đang lưu…" briefly.
- Card transforms into emerald-colored "✅ Đã thêm: Sinh nhật vợ — 25/12/<year>".
- Navigate to `/important-dates` — entry shows up in the list.

- [ ] **Scenario 3: Dismiss**

Type `kỷ niệm 14/2`. Click "Bỏ qua". Expect: card transforms to "⊘ Đã bỏ qua đề xuất ngày" (stone-colored).

- [ ] **Scenario 4: Multi-date**

Type: `sinh nhật vợ 25/12, kỷ niệm cưới 14/2/2027, giỗ ông 12/3 âm`. Expect: 3 separate cards (each with its own confirm/dismiss buttons).

- [ ] **Scenario 5: Edge — money present**

Type: `mua quà sinh nhật vợ 500k`. Expect: a `logged` transaction card (rose, expense), NOT an important-date proposal.

- [ ] **Scenario 6: Lunar**

Type: `giỗ bố 12/3 âm`. Expect: card date shows "12/3/<year> (âm)".

- [ ] **Scenario 7: Reload persistence**

After confirming a card in scenario 2, reload the page (F5). Expect: the same chat session loads with the card still in "✅ Đã thêm" state (not back to confirm-buttons state).

After dismissing a card in scenario 3, reload. Expect: card stays in "Đã bỏ qua" state.

- [ ] **Scenario 8: Clarify**

Type: `sinh nhật vợ` (no date). Expect: a clarify action card asking "Sinh nhật vợ vào ngày nào?".

- [ ] **Final lint + tsc + build (api)**

```bash
cd /Users/manhvd/Desktop/concord
pnpm --filter api lint
pnpm --filter api build
pnpm --filter web lint
cd apps/web && npx tsc --noEmit
```

All must pass.

---

## Acceptance criteria recap

1. Single-date message → 1 preview card with confirm/dismiss
2. Confirm → API create succeeds → card morphs to "Đã thêm" + visible in /important-dates
3. Dismiss → card morphs to "Đã bỏ qua"
4. Reload preserves confirmed/dismissed state via localStorage
5. Multi-date → N preview cards (one per date)
6. Money keyword → log_transaction (no proposal)
7. Lunar keyword → `isLunar=true` shown in card
8. Missing date → clarify
9. `pnpm --filter api lint`, `pnpm --filter api build`, `pnpm --filter web lint`, `cd apps/web && npx tsc --noEmit` all pass.
