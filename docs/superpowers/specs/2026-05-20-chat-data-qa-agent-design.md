# Chat Q&A Agent — Data-Aware Answers in Chat

## Bối cảnh

Concord chat hiện tại chỉ có 1 subagent (`ParserSubagent`) — chuyên log/edit/delete transactions, debts, important dates. User không hỏi được dữ liệu ("chi tiêu Ăn ngoài tháng này?", "tuần này có việc gì?", "kỷ niệm cưới ngày nào?"). Cần extend chat thành conversational interface trả lời được câu hỏi dựa trên dữ liệu thực, đồng thời giữ privacy semantics đã có (`session.visibility = 'private' | 'public'`).

## Quyết định

- **Architecture**: Router + 2 subagents. Lightweight Router (Haiku) classify intent `'action' | 'question'` → dispatch sang `ParserSubagent` (action lane, giữ nguyên) hoặc `AnswererSubagent` (Sonnet, new).
- **MVP scope**: single-month focus. Multi-month/year trends để giai đoạn sau.
- **Empty data**: trả lời "không có dữ liệu" + gợi ý action nếu phù hợp (vd "Bạn có muốn ghi lương tháng 6 bây giờ không?").
- **Privacy edge**: session `private` từ chối câu hỏi về dữ liệu user khác ("đây là chat riêng, chỉ có dữ liệu của bạn — mở chat chung để xem cross-user").

## Thiết kế

### Flow

```
POST /api/chat { message, sessionId }
   │
   ▼
ChatService.handle()
   │
   ├─► RouterSubagent.classify(message, history)
   │      └── Haiku, single tool 'route', no prose
   │
   ├─ intent='action' ──► ParserSubagent.parse(...)       (existing flow, unchanged)
   │
   └─ intent='question' ─► AnswererSubagent.answer(...)   (new)
                            │
                            └── Sonnet, prose reply + 0..N tool calls
                                                     ↓
                                       6 read-only tools below
```

`ChatResponseDto` shape không đổi:
- Parser: `reply` + `actions[]` (như cũ).
- Answerer: `reply` (prose) + `actions=[]` (empty).

### `RouterSubagent` (new)

- Model: Haiku.
- Skill prompt ngắn (~300 từ + 6–8 examples).
- Tool duy nhất:
  ```ts
  {
    name: 'route',
    description: 'Classify intent of the user message.',
    input_schema: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: ['action', 'question'] },
        reason: { type: 'string', description: 'Short justification (debug log only).' }
      },
      required: ['intent']
    }
  }
  ```
- `tool_choice: { type: 'tool', name: 'route' }` — force structured output.
- Examples (skill):
  - "ăn trưa 50k phở" → action (log)
  - "sửa giao dịch lúc nãy thành 60k" → action (update)
  - "tháng này chi Ăn ngoài bao nhiêu?" → question
  - "tuần này tôi có việc gì?" → question
  - "kỷ niệm cưới ngày nào?" → question
  - "ghi 200k đi grab xong hỏi tuần này còn dư bao nhiêu" → action (ưu tiên action khi mixed)
- Caching: skill prompt cached (`ephemeral`).

### `AnswererSubagent` (new)

- Model: Sonnet (default reasoning).
- Skill prompt ~1500 từ:
  - Mục tiêu: trả lời câu hỏi về tài chính / công việc / ngày quan trọng của user.
  - Tools available (mô tả từng tool + khi nào dùng).
  - Style guide: ngắn gọn, dùng `formatVND` style VND, mention category icon, không lặp lại số liệu thừa.
  - Privacy rule: "Trong session `private`, dữ liệu chỉ thuộc về user. Nếu user hỏi về người khác, từ chối lịch sự và đề xuất mở chat chung."
  - Empty data: nếu tool trả empty, nói rõ "không có dữ liệu" + gợi ý action.
  - Time anchoring: nếu user nói "tháng này", dùng `currentFinancialMonth` (đã được inject).
- Skill cached.

### Read-only tools cho Answerer

Tất cả tools nhận `user` + `scope` (`'personal' | 'joint' | 'all'`) qua closure, không qua model input. Scope được derive ở orchestrator dựa trên `session.visibility`:
- `private` → `scope = 'personal'` (chỉ fund cá nhân user, hoặc tasks/dates không filter scope).
- `public` → `scope = 'joint'` (chỉ joint funds + cross-user public data như tasks/dates family-wide).

> **Lưu ý privacy**: Tool layer enforce scope, không tin model. Nếu Sonnet "tưởng tượng" gọi với fundId không thuộc visible set → BE silently filter.

**1. `search_transactions(year, month, categoryName?, query?, limit?=50)`**
- Resolve range qua `getFinancialMonthRange(year, month, family.cutoffDay)`.
- Filter `t.date >= start AND t.date < end`.
- `categoryName` → resolve category bằng name match (case-insensitive). Nếu không match → return empty + meta.
- `query` → `note ILIKE %query%`.
- Scope:
  - `personal` → `fund.ownerId = user.id AND fund.type='personal'`.
  - `joint` → `fund.type='joint'`.
- Returns:
  ```ts
  {
    range: { start, end },
    items: Array<{ date, amount, category, fund, note }>,
    total: number,
    expenseSum: number,
    incomeSum: number,
  }
  ```

**2. `get_monthly_report(year, month)`**
- Wrap `ReportsService.monthly(user, year, month, scope)` — đã có sẵn.
- Returns full `MonthlyReport` (income/expense/net/byCategory/byDay).

**3. `list_funds()`**
- Wrap `FundsService.listForUser(user)` đã có, sau đó filter theo scope:
  - `personal` → keep funds `ownerId=user.id` hoặc joint với public visibility (xem `accessLevel`).
  - `joint` → keep funds `type='joint'`.
- Returns: `[{ name, type, balance, purpose, accessLevel }]`.

**4. `get_goals_progress()`**
- Wrap `GoalsService.listForUser(user)` — đã enforce scope ở service level.
- Returns: `[{ name, type, period, targetAmount, currentProgress, paceStatus, daysRemaining }]`.

**5. `list_upcoming_dates(limit?=10)`**
- Wrap `ImportantDatesService.listUpcoming(user, limit)`.
- Family-wide, không filter scope (sinh nhật cả 2 vợ chồng đều OK trong cả 2 session).
- Returns: `[{ name, kind, occursOn, daysUntil, isLunar }]`.

**6. `list_tasks_this_week()`**
- Wrap `TasksService.listForUser(user, currentWeekISO)`.
- Family-wide.
- Returns: `[{ id, title, status, assignedTo, dueDate }]`.

### Privacy enforcement summary

| Session | Tool scope | Cross-user query |
|---|---|---|
| `private` | `personal` (fund của user) | Refuse + suggest "mở chat chung" |
| `public` | `joint` (Quỹ Chung) | OK, aggregate trên joint data |

Nếu user trong `private` hỏi "tổng chi family" → answer model phải refuse. Skill examples cover edge case này.

Tool-level enforcement (defense in depth):
- `search_transactions` / `get_monthly_report` luôn pass scope vào service; service đã có existing privacy guard (`visibleFundIds()` + check `fund.type === 'personal' && fund.ownerId !== user.id` → ForbiddenException).
- Nếu model cố pass `fundId` không thuộc visible set → BE silently filter (existing pattern).

### Files mới

```
apps/api/src/agent/subagents/
├── router/
│   ├── router.subagent.ts      (~80 LOC)
│   ├── router.tools.ts          (~30 LOC)
│   └── skill.md                  (~500 từ)
└── answerer/
    ├── answerer.subagent.ts    (~250 LOC)
    ├── answerer.tools.ts        (~150 LOC, 6 tools)
    └── skill.md                  (~1500 từ)
```

### Files thay đổi

- `apps/api/src/agent/agent.module.ts` — register Router + Answerer.
- `apps/api/src/modules/chat/chat.module.ts` — import 2 subagent.
- `apps/api/src/modules/chat/chat.service.ts` — gọi Router → dispatch.

### Không đụng

- `ParserSubagent` skill + tools + behavior (kept as-is for action lane).
- `ChatSession` / `ChatMessage` schema.
- FE chat surface (vẫn `POST /api/chat`, response shape backward compat).
- Existing services (Reports/Goals/Tasks/ImportantDates/Funds/Transactions) không đổi signature — answerer tool wrap chúng.

## Cost / Latency Budget

Mỗi message:
- Router: 1 Haiku call, ~50–150 tokens output, ~100ms, ~$0.00005.
- Parser (action lane): không đổi (~$0.001/msg trung bình).
- Answerer (question lane): 1–3 Sonnet calls (initial → tool result → final reply), ~500–2000 output tokens, ~1500ms, ~$0.01–0.03/msg.

User experience: cost tăng cho question messages nhưng justified vì giá trị thông tin trả về. Action messages chỉ +1 router call latency (~100ms) — chấp nhận được.

## Edge cases

1. **Câu hỏi mơ hồ** ("thế nào?" sau khi log lương 25M): Router classify 'question', Answerer dùng history để hiểu context.
2. **Mixed message** ("ghi 200k đi grab xong hỏi tuần này còn dư bao nhiêu"): Router ưu tiên 'action' (skill example). Parser log, user sẽ ask follow-up.
3. **Question về fund cụ thể** ("Quỹ Mạnh còn bao nhiêu?") trong session private khác user: Answerer scope='personal' → list_funds chỉ trả fund của user → answerer refuse "không có fund tên 'Quỹ Mạnh' trong dữ liệu của bạn".
4. **Câu hỏi vượt khả năng tools** ("So sánh chi Ăn ngoài 3 tháng gần nhất"): Answerer nói "MVP chỉ hỗ trợ 1 tháng — sắp tới sẽ có multi-month".
5. **Router classify sai** (vd "200k đi grab" → 'question'): Answerer thấy không có dữ liệu → gợi ý action. UX không tốt nhưng không break. Skill examples giảm thiểu.
6. **Anthropic API down**: Existing error handling — return 500 message, FE hiện toast.

## Verification

- BE unit test `RouterSubagent`: 10 examples, verify intent đúng 9/10.
- BE integration test `AnswererSubagent` với mock DB: hỏi "chi Ăn ngoài tháng này" → answer chứa số đúng.
- BE privacy test: private session, hỏi data của user khác → answerer refuse (substring "chat riêng" hoặc "chat chung" trong reply).
- FE smoke test:
  - Tạo public session → "chi tiêu Ăn ngoài tháng này?" → answer chứa số + breakdown.
  - Tạo private session → "tuần này có việc gì?" → list tasks.
  - Private session → "vợ tôi chi bao nhiêu?" → refuse polite.

## Risks

- **Router accuracy** ~90%: misclassify ~1/10 messages. Mitigation: skill examples + bias toward 'action' when verb log/edit detected.
- **Sonnet hallucination**: tool layer always source-of-truth. Answer prompt: "Chỉ trả lời từ tool output, không tự tạo số liệu."
- **Latency Sonnet**: 2-3s end-to-end. FE nên có typing indicator (chắc đã có).
- **Cost spike**: Sonnet cho mỗi question. Nếu vol cao → cân nhắc fallback Haiku cho câu hỏi đơn giản (sau MVP).

## Không làm

- Multi-month / trend analysis (giai đoạn sau).
- Streaming response.
- Caching kết quả tools (Anthropic prompt cache đủ rồi).
- Persistent agent state ngoài chat_messages.
- Tool để tạo report PDF.
