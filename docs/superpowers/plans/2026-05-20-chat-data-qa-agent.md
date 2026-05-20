# Chat Q&A Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho agent chat trả lời được câu hỏi về tài chính / công việc / ngày quan trọng dựa trên dữ liệu thực, tôn trọng privacy của session (`private`/`public`).

**Architecture:** Lightweight `RouterSubagent` (Haiku) classify intent action/question. `ChatService` dispatch sang `ParserSubagent` (giữ nguyên) hoặc `AnswererSubagent` (Sonnet, mới) với 6 read-only tools. Tool layer enforce scope dựa trên `session.visibility`.

**Tech Stack:** NestJS 11, Anthropic SDK (Sonnet 4.6 + Haiku 4.5), TypeORM 0.3, existing services (Reports/Goals/Tasks/ImportantDates/Funds/Transactions). Jest cho BE.

**Spec:** [docs/superpowers/specs/2026-05-20-chat-data-qa-agent-design.md](../specs/2026-05-20-chat-data-qa-agent-design.md)

---

## File Structure

**Backend only — không đụng FE, không đụng schema.**

```
apps/api/src/agent/subagents/
├── parser/                       (unchanged)
├── router/
│   ├── router.subagent.ts        (~80 LOC)
│   ├── router.tools.ts           (~25 LOC)
│   ├── router.subagent.spec.ts   (unit tests)
│   └── skill.md                  (~500 từ)
└── answerer/
    ├── answerer.subagent.ts      (~280 LOC)
    ├── answerer.tools.ts         (~180 LOC, 6 tools)
    ├── answerer.subagent.spec.ts (unit tests, mock LLM)
    └── skill.md                  (~1500 từ)
```

**Modified:**
- `apps/api/src/agent/agent.module.ts` — register 2 subagents mới.
- `apps/api/src/modules/chat/chat.service.ts` — gọi Router trước, dispatch.
- `apps/api/src/modules/chat/chat.module.ts` — không đổi (đã import AgentModule).

**Convention reuse:**
- Skill markdown load qua `fs.readFileSync(path.join(__dirname, 'skill.md'))` (giống Parser).
- `nest-cli.json` asset glob `agent/subagents/**/skill.md` tự copy ra dist (đã có).
- Anthropic call qua `AnthropicService.client.messages.create(...)`.
- Privacy: scope ('personal'|'joint') derive từ `session.visibility`. Tools nhận user + scope qua closure.

---

### Task 1: Skill files (router + answerer)

**Files:**
- Create: `apps/api/src/agent/subagents/router/skill.md`
- Create: `apps/api/src/agent/subagents/answerer/skill.md`

Skill prompts là static text, không cần unit test. Tạo trước để các task sau load.

- [ ] **Step 1: Create router skill**

Create `apps/api/src/agent/subagents/router/skill.md` with this exact content:

```markdown
# Router Subagent

Bạn là **router** trong Concord chat. Nhiệm vụ DUY NHẤT của bạn: phân loại tin nhắn user thành 1 trong 2 intent.

## Intents

- **`action`** — user muốn THỰC HIỆN một hành động: ghi giao dịch, sửa giao dịch, xóa giao dịch, mở khoản nợ, ghi thanh toán nợ, đề xuất ngày quan trọng, tạo category. Có động từ "ghi", "log", "sửa", "xóa", "cho vay", "trả", hoặc câu mệnh lệnh ngắn ("trưa 50k bún bò", "lương về 25M").

- **`question`** — user HỎI dữ liệu: "bao nhiêu?", "tháng này chi gì?", "tuần này có việc gì?", "kỷ niệm cưới ngày nào?", "quỹ chung còn bao nhiêu?", "lương tháng 5 đâu rồi?". Bao gồm cả câu yêu cầu tóm tắt / phân tích / so sánh dựa trên dữ liệu đã có.

## Rules

1. **Mixed messages** ("ghi 200k đi grab xong cho biết tuần này còn dư bao nhiêu"): ưu tiên `action` — Parser sẽ log, user hỏi lại ở turn sau.
2. **Câu hỏi xác minh trước khi log** ("tôi đã ghi 200k chưa?"): `question` (đang hỏi, chưa muốn log mới).
3. **Greetings / chitchat** ("hi", "ok", "cảm ơn"): `question` (Answerer sẽ phản hồi tự nhiên hoặc nói rõ phạm vi).
4. **Câu mệnh lệnh không liên quan tài chính** ("dịch sang tiếng Anh"): `question` (Answerer sẽ từ chối lịch sự).

## Output format

Bạn **PHẢI** gọi tool `route` chính xác 1 lần, không được trả text-only. Output ngắn:
- `intent`: 'action' hoặc 'question'.
- `reason`: 1 câu ngắn giải thích (debug, không lộ cho user).

## Examples

| User message | intent | reason |
|---|---|---|
| ăn trưa 50k phở | action | log expense |
| sửa giao dịch lúc nãy thành 60k | action | update transaction |
| xóa giao dịch lương về 25M | action | delete |
| cho Linh vay 2 triệu từ quỹ chung | action | open debt |
| Linh trả 500k | action | record debt payment |
| Sinh nhật vợ 12/05 | action | propose important date |
| Tháng này chi Ăn ngoài bao nhiêu? | question | query monthly category |
| Tuần này tôi có việc gì? | question | query tasks |
| Kỷ niệm cưới ngày nào? | question | query important date |
| Quỹ chung còn bao nhiêu? | question | query fund balance |
| Mục tiêu năm còn xa không? | question | query goal progress |
| Hi | question | greeting → answerer |
| Tôi tiết kiệm có ổn không? | question | analysis on goal data |
| Ghi 200k cà phê. Tuần này tổng chi bao nhiêu? | action | mixed → prefer action |
```

- [ ] **Step 2: Create answerer skill**

Create `apps/api/src/agent/subagents/answerer/skill.md` with this exact content:

```markdown
# Answerer Subagent

Bạn là **answerer** trong Concord — trợ lý tài chính + sinh hoạt cho cặp đôi. Bạn TRẢ LỜI câu hỏi dựa trên dữ liệu thực, không thực hiện hành động (log/edit/delete). Mọi action delegate cho Parser ở route khác.

## Quy tắc cốt lõi

1. **Chỉ trả lời từ dữ liệu tool trả về.** Không tự bịa số, không suy đoán balance/category. Nếu tool empty → nói thẳng "không có dữ liệu".
2. **Privacy theo session.** Context block sẽ ghi rõ `scope = 'personal'` (chat riêng) hoặc `scope = 'joint'` (chat chung). Bạn CHỈ thấy dữ liệu trong scope đó. Nếu user hỏi về scope khác, **từ chối lịch sự** và đề xuất mở chat phù hợp.
3. **Trả lời ngắn gọn.** Trả lời thẳng câu hỏi, không lặp lại số dư thừa. Số tiền VND format `1.234.567đ` (dấu chấm phân cách hàng nghìn). Icon category nên giữ khi liệt kê (vd "🍽️ Ăn ngoài").
4. **Thời gian.** Khi user nói "tháng này", "tuần này" — dùng context (`currentFinancialYear`, `currentFinancialMonth`, `currentWeekISO`). Khi user nói "tháng 5" mà không nói năm → dùng năm hiện tại.
5. **Empty data** → gợi ý hành động: "Chưa có dữ liệu chi tiêu Ăn ngoài tháng 5. Bạn có muốn ghi giao dịch đầu tiên không?". Nhưng KHÔNG tự log — user phải gửi message khác.
6. **Beyond MVP capability**: câu hỏi multi-month / trend / so sánh tháng / forecast → trả lời "Hiện chỉ hỗ trợ 1 tháng. Sắp tới sẽ có multi-month/trend."

## Tools

- **`search_transactions(year, month, categoryName?, query?, limit?)`** — list giao dịch của tháng tài chính (year/month theo financial cutoff). Hỗ trợ filter category name hoặc note ILIKE. Dùng khi user hỏi danh sách hoặc tổng theo category cụ thể.
- **`get_monthly_report(year, month)`** — tổng quan tháng: income/expense/net/byCategory/byDay. Dùng khi user hỏi tổng quan tháng hoặc breakdown.
- **`list_funds()`** — số dư các quỹ trong scope.
- **`get_goals_progress()`** — list mục tiêu + tiến độ + pace (ahead/on_track/behind).
- **`list_upcoming_dates(limit?)`** — sinh nhật/kỷ niệm sắp tới (family-wide trong cả 2 scope).
- **`list_tasks_this_week()`** — việc cần làm tuần này (family-wide).

## Examples

### Câu hỏi đơn giản

User (public): "Tháng này chi Ăn ngoài bao nhiêu?"
→ Gọi `search_transactions(year=now, month=now, categoryName="Ăn ngoài")` → tính sum.
→ Reply: "Tháng 5 quỹ Chung chi 🍽️ Ăn ngoài **1.217.000đ** qua 4 giao dịch."

User (public): "Quỹ chung còn bao nhiêu?"
→ Gọi `list_funds()` → filter joint.
→ Reply: "Quỹ Chung 💛 hiện còn **5.420.000đ**."

User (private): "Quỹ Mạnh còn bao nhiêu?" (đang trong session của user Mạnh)
→ Gọi `list_funds()` → 1 fund duy nhất.
→ Reply: "Quỹ riêng của bạn còn **8.300.000đ**."

User (public): "Tuần này tôi có việc gì?"
→ Gọi `list_tasks_this_week()`.
→ Reply: "Tuần này có 3 việc: 1) Đón Sóc; 2) Mua bỉm; 3) Thanh toán điện. Trong đó 2 việc chưa làm xong."

User (any): "Kỷ niệm cưới ngày nào?"
→ Gọi `list_upcoming_dates(limit=20)` → filter `kind='anniversary'` + tên chứa "cưới".
→ Reply: "💍 Kỷ niệm cưới của bạn là **15/11** (còn 178 ngày)."

### Privacy refusal

User (private session): "Vợ tôi chi bao nhiêu tháng này?"
→ KHÔNG gọi tool. Reply: "Đây là chat riêng nên mình chỉ thấy dữ liệu của bạn. Mở chat chung để hỏi về chi tiêu Quỹ Chung hoặc của vợ."

### Empty data

User: "Lương tháng 6 đâu rồi?"
→ Gọi `search_transactions(year=now, month=6, query="lương")`.
→ Empty.
→ Reply: "Chưa có giao dịch lương nào trong tháng 6. Bạn có muốn ghi lương bây giờ không? (vd: 'lương về 25M')."

### Beyond MVP

User: "So sánh chi Ăn ngoài 3 tháng gần nhất?"
→ Reply: "Hiện chỉ hỗ trợ tổng kết 1 tháng. Multi-month sẽ ra trong bản tới. Bạn muốn xem tháng nào trước?"

## Output format

Trả lời text tự nhiên (markdown-free, chỉ dấu nhấn quan trọng dùng **bold**). KHÔNG emit tool_use trừ khi gọi 1 trong 6 tools trên. KHÔNG trả JSON. KHÔNG dùng `clarify`, không có tool đó ở route này.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/api/src/agent/subagents/router/skill.md apps/api/src/agent/subagents/answerer/skill.md
git commit -m "feat(api): add skill markdown for router and answerer subagents"
```

---

### Task 2: Router tools + subagent

**Files:**
- Create: `apps/api/src/agent/subagents/router/router.tools.ts`
- Create: `apps/api/src/agent/subagents/router/router.subagent.ts`

- [ ] **Step 1: Create tool definition**

Create `apps/api/src/agent/subagents/router/router.tools.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';

export type RouteIntent = 'action' | 'question';

export interface RouteInput {
  intent: RouteIntent;
  reason?: string;
}

export const routeTool: Anthropic.Tool = {
  name: 'route',
  description:
    'Classify the user message into one intent: "action" (do something — log/edit/delete) or "question" (read/answer from data).',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['action', 'question'],
        description: 'Intent classification.',
      },
      reason: {
        type: 'string',
        description: 'Short rationale for logging (≤80 chars).',
      },
    },
    required: ['intent'],
  },
};
```

- [ ] **Step 2: Create subagent**

Create `apps/api/src/agent/subagents/router/router.subagent.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from '../../core/anthropic.service';
import { RouteInput, routeTool, type RouteIntent } from './router.tools';

export interface RouteResult {
  intent: RouteIntent;
  reason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

@Injectable()
export class RouterSubagent {
  private readonly logger = new Logger(RouterSubagent.name);
  private readonly skill: string;

  constructor(private readonly anthropic: AnthropicService) {
    const skillPath = path.join(__dirname, 'skill.md');
    this.skill = fs.readFileSync(skillPath, 'utf8');
  }

  async classify(
    message: string,
    history: Array<{ role: 'user' | 'agent'; text: string }> = [],
  ): Promise<RouteResult> {
    const recent = history
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'U' : 'A'}: ${m.text.slice(0, 200)}`)
      .join('\n');
    const userBlock = recent
      ? `Recent history:\n${recent}\n\nCurrent message:\n${message}`
      : `Current message:\n${message}`;

    const response = await this.anthropic.client.messages.create({
      model: this.anthropic.fastModel,
      max_tokens: 200,
      system: [
        {
          type: 'text',
          text: this.skill,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [routeTool],
      tool_choice: { type: 'tool', name: 'route' },
      messages: [{ role: 'user', content: userBlock }],
    });

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'route') {
        const input = block.input as RouteInput;
        return {
          intent: input.intent,
          reason: input.reason ?? null,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      }
    }

    this.logger.warn('Router did not return a tool_use block; defaulting to question');
    return {
      intent: 'question',
      reason: 'fallback (no tool_use)',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
```

- [ ] **Step 3: Build**

Run: `cd /Users/manhvd/Desktop/concord && pnpm --filter api build`
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/api/src/agent/subagents/router/
git commit -m "feat(api): add RouterSubagent for intent classification"
```

---

### Task 3: Answerer tools

**Files:**
- Create: `apps/api/src/agent/subagents/answerer/answerer.tools.ts`

- [ ] **Step 1: Create tool definitions**

Create `apps/api/src/agent/subagents/answerer/answerer.tools.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';

export type AnswererScope = 'personal' | 'joint';

export interface SearchTransactionsInput {
  year: number;
  month: number;
  categoryName?: string;
  query?: string;
  limit?: number;
}

export interface GetMonthlyReportInput {
  year: number;
  month: number;
}

export interface ListUpcomingDatesInput {
  limit?: number;
}

export const searchTransactionsTool: Anthropic.Tool = {
  name: 'search_transactions',
  description:
    'List transactions in a given financial month, optionally filtered by category name or note text. Returns date, amount, category, fund, note for each.',
  input_schema: {
    type: 'object',
    properties: {
      year: { type: 'number', description: 'Financial year (e.g. 2026).' },
      month: {
        type: 'number',
        description: 'Financial month 1–12. Range is resolved using the family cutoff.',
      },
      categoryName: {
        type: 'string',
        description: 'Exact category name (case-insensitive). Optional.',
      },
      query: {
        type: 'string',
        description: 'Free-text substring matched on note. Optional.',
      },
      limit: { type: 'number', description: 'Max items (default 50, cap 200).' },
    },
    required: ['year', 'month'],
  },
};

export const getMonthlyReportTool: Anthropic.Tool = {
  name: 'get_monthly_report',
  description:
    'Get a full monthly report for the given financial month: income, expense, net, byCategory, byDay. Scope (personal/joint) is applied automatically.',
  input_schema: {
    type: 'object',
    properties: {
      year: { type: 'number' },
      month: { type: 'number' },
    },
    required: ['year', 'month'],
  },
};

export const listFundsTool: Anthropic.Tool = {
  name: 'list_funds',
  description:
    'List funds visible in the current chat scope. Returns name, type, balance, purpose. No parameters.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export const getGoalsProgressTool: Anthropic.Tool = {
  name: 'get_goals_progress',
  description:
    'List savings/investment goals visible to the user with current progress and pace. No parameters.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export const listUpcomingDatesTool: Anthropic.Tool = {
  name: 'list_upcoming_dates',
  description:
    'List family-wide upcoming birthdays/anniversaries with daysUntil. Available in both private and joint scopes.',
  input_schema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Default 10, cap 30.' },
    },
    required: [],
  },
};

export const listTasksThisWeekTool: Anthropic.Tool = {
  name: 'list_tasks_this_week',
  description:
    'List family-wide tasks for the current ISO week (title, status, assignee). No parameters.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export const answererTools: Anthropic.Tool[] = [
  searchTransactionsTool,
  getMonthlyReportTool,
  listFundsTool,
  getGoalsProgressTool,
  listUpcomingDatesTool,
  listTasksThisWeekTool,
];
```

- [ ] **Step 2: Build**

Run: `cd /Users/manhvd/Desktop/concord && pnpm --filter api build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/api/src/agent/subagents/answerer/answerer.tools.ts
git commit -m "feat(api): define answerer tool schemas"
```

---

### Task 4: Answerer subagent — skeleton + tool dispatch

**Files:**
- Create: `apps/api/src/agent/subagents/answerer/answerer.subagent.ts`

- [ ] **Step 1: Create subagent**

Create `apps/api/src/agent/subagents/answerer/answerer.subagent.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Family } from '../../../modules/families/entities/family.entity';
import { Fund } from '../../../modules/funds/entities/fund.entity';
import { Category } from '../../../modules/categories/entities/category.entity';
import { FundsService } from '../../../modules/funds/funds.service';
import { GoalsService } from '../../../modules/goals/goals.service';
import { ImportantDatesService } from '../../../modules/important-dates/important-dates.service';
import { ReportsService } from '../../../modules/reports/reports.service';
import { TasksService } from '../../../modules/tasks/tasks.service';
import { TransactionsService } from '../../../modules/transactions/transactions.service';
import { OPENING_BALANCE_NOTE } from '../../../modules/funds/opening-balance.constants';
import { User } from '../../../modules/users/entities/user.entity';
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
} from '../../../shared/common/date-helpers';
import { AnthropicService } from '../../core/anthropic.service';
import {
  AnswererScope,
  GetMonthlyReportInput,
  ListUpcomingDatesInput,
  SearchTransactionsInput,
  answererTools,
} from './answerer.tools';

export interface AnswerResult {
  reply: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

const MAX_TOOL_ROUNDS = 3;

@Injectable()
export class AnswererSubagent {
  private readonly logger = new Logger(AnswererSubagent.name);
  private readonly skill: string;

  constructor(
    private readonly anthropic: AnthropicService,
    private readonly transactionsService: TransactionsService,
    private readonly reportsService: ReportsService,
    private readonly fundsService: FundsService,
    private readonly goalsService: GoalsService,
    private readonly importantDatesService: ImportantDatesService,
    private readonly tasksService: TasksService,
    @InjectRepository(Family) private readonly familyRepo: Repository<Family>,
    @InjectRepository(Fund) private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {
    const skillPath = path.join(__dirname, 'skill.md');
    this.skill = fs.readFileSync(skillPath, 'utf8');
  }

  async answer(
    message: string,
    user: User,
    scope: AnswererScope,
    history: Array<{ role: 'user' | 'agent'; text: string }> = [],
  ): Promise<AnswerResult> {
    const context = await this.buildContext(user, scope);

    const messages: Array<{
      role: 'user' | 'assistant';
      content: Anthropic.MessageParam['content'];
    }> = buildMessages(history, message);

    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response: Anthropic.Message =
        await this.anthropic.client.messages.create({
          model: this.anthropic.defaultModel,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: this.skill,
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: context },
          ],
          tools: answererTools,
          messages,
        });

      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      stopReason = response.stop_reason;

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return {
          reply: reply || 'Xin lỗi, mình chưa hiểu câu hỏi. Bạn nói cụ thể hơn được không?',
          stopReason,
          usage: { inputTokens, outputTokens },
        };
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const result = await this.runTool(use.name, use.input, user, scope);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return {
      reply: 'Mình cần thêm thời gian để trả lời câu này. Thử hỏi lại với câu ngắn gọn hơn nhé.',
      stopReason: 'max_rounds',
      usage: { inputTokens, outputTokens },
    };
  }

  private async runTool(
    name: string,
    input: unknown,
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    try {
      switch (name) {
        case 'search_transactions':
          return await this.toolSearchTransactions(
            input as SearchTransactionsInput,
            user,
            scope,
          );
        case 'get_monthly_report':
          return await this.toolGetMonthlyReport(
            input as GetMonthlyReportInput,
            user,
            scope,
          );
        case 'list_funds':
          return await this.toolListFunds(user, scope);
        case 'get_goals_progress':
          return await this.toolGoalsProgress(user);
        case 'list_upcoming_dates':
          return await this.toolUpcomingDates(
            input as ListUpcomingDatesInput,
            user,
          );
        case 'list_tasks_this_week':
          return await this.toolTasksThisWeek(user);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${name} failed: ${msg}`);
      return { error: msg };
    }
  }

  private async buildContext(user: User, scope: AnswererScope): Promise<string> {
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId! });
    const cutoffDay = family.financialMonthCutoffDay;
    const now = new Date();
    const fm = getCurrentFinancialMonth(now, cutoffDay);
    const week = currentIsoWeek(now);
    const scopeLabel = scope === 'personal' ? 'private (chỉ của bạn)' : 'joint (Quỹ Chung)';

    return [
      '## Current Context',
      `- User: ${user.name} (${user.role === 'husband' ? 'chồng' : 'vợ'})`,
      `- Scope: ${scopeLabel}`,
      `- Financial cutoffDay: ${cutoffDay}`,
      `- Current financial month: ${fm.year}-${String(fm.month).padStart(2, '0')}`,
      `- Current ISO week: ${week}`,
      `- Now: ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ].join('\n');
  }

  private async toolSearchTransactions(
    input: SearchTransactionsInput,
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId! });
    const { start, end } = getFinancialMonthRange(
      input.year,
      input.month,
      family.financialMonthCutoffDay,
    );
    const visibleFundIds = await this.scopedFundIds(user, scope);
    if (visibleFundIds.length === 0) {
      return { range: { start, end }, items: [], total: 0, expenseSum: 0, incomeSum: 0 };
    }

    let categoryId: string | undefined;
    if (input.categoryName) {
      const cat = await this.categoryRepo
        .createQueryBuilder('c')
        .where('c.family_id = :familyId', { familyId: user.familyId! })
        .andWhere('LOWER(c.name) = LOWER(:name)', { name: input.categoryName })
        .getOne();
      if (!cat) {
        return {
          range: { start, end },
          items: [],
          total: 0,
          expenseSum: 0,
          incomeSum: 0,
          note: `Không tìm thấy category "${input.categoryName}".`,
        };
      }
      categoryId = cat.id;
    }

    const result = await this.transactionsService.listForUser(user, {
      from: start,
      to: new Date(end.getTime() - 1),
      categoryId,
      q: input.query,
      limit: Math.min(input.limit ?? 50, 200),
    });
    const inScope = result.items.filter((t) => visibleFundIds.includes(t.fund.id));
    let expenseSum = 0;
    let incomeSum = 0;
    for (const t of inScope) {
      if (t.amount < 0) expenseSum += -t.amount;
      else incomeSum += t.amount;
    }
    return {
      range: { start, end },
      items: inScope.map((t) => ({
        date: t.date,
        amount: t.amount,
        category: t.category?.name ?? null,
        icon: t.category?.icon ?? null,
        fund: t.fund.name,
        note: t.note,
      })),
      total: inScope.length,
      expenseSum,
      incomeSum,
    };
  }

  private async toolGetMonthlyReport(
    input: GetMonthlyReportInput,
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    const reportScope = scope === 'personal' ? 'all' : 'joint';
    const report = await this.reportsService.monthly(
      user,
      input.year,
      input.month,
      reportScope,
    );
    if (scope === 'personal') {
      const myFundIds = await this.scopedFundIds(user, scope);
      return {
        ...report,
        byCategory: report.byCategory,
        scopeNote: `Filtered to your personal funds: ${myFundIds.length} fund(s).`,
      };
    }
    return report;
  }

  private async toolListFunds(user: User, scope: AnswererScope): Promise<unknown> {
    const funds = await this.fundsService.listForUser(user);
    const filtered = funds.filter((f) => {
      if (scope === 'personal') return f.type === 'personal' && f.ownerId === user.id;
      return f.type === 'joint';
    });
    return filtered.map((f) => ({
      name: f.name,
      type: f.type,
      purpose: f.purpose,
      balance: f.balance ?? 0,
    }));
  }

  private async toolGoalsProgress(user: User): Promise<unknown> {
    const goals = await this.goalsService.listForUser(user);
    return goals.map((g) => ({
      name: g.name,
      type: g.type,
      period: g.period,
      targetAmount: g.targetAmount,
      currentProgress: g.currentProgress,
      paceStatus: g.paceStatus,
      daysRemaining: g.daysRemaining,
    }));
  }

  private async toolUpcomingDates(
    input: ListUpcomingDatesInput,
    user: User,
  ): Promise<unknown> {
    const limit = Math.min(input.limit ?? 10, 30);
    const view = await this.importantDatesService.listUpcoming(
      user.familyId!,
      limit,
    );
    return view.items.map((d) => ({
      name: d.name,
      kind: d.kind,
      occursOn: d.occursOn,
      daysUntil: d.daysUntil,
      isLunar: d.isLunar,
    }));
  }

  private async toolTasksThisWeek(user: User): Promise<unknown> {
    const tasks = await this.tasksService.list(user);
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assignedToUserId: t.assignedToUserId ?? null,
      dueDate: t.dueDate ?? null,
    }));
  }

  private async scopedFundIds(
    user: User,
    scope: AnswererScope,
  ): Promise<string[]> {
    const where =
      scope === 'personal'
        ? { familyId: user.familyId!, type: 'personal' as const, ownerId: user.id }
        : { familyId: user.familyId!, type: 'joint' as const };
    const funds = await this.fundRepo.find({ where, select: { id: true } });
    return funds.map((f) => f.id);
  }
}

void OPENING_BALANCE_NOTE;

function currentIsoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function buildMessages(
  history: Array<{ role: 'user' | 'agent'; text: string }>,
  currentMessage: string,
): Array<{ role: 'user' | 'assistant'; content: Anthropic.MessageParam['content'] }> {
  const out: Array<{ role: 'user' | 'assistant'; content: Anthropic.MessageParam['content'] }> = [];
  for (const h of history) {
    const role: 'user' | 'assistant' = h.role === 'user' ? 'user' : 'assistant';
    const text = h.text || '(empty)';
    if (out.length > 0 && out[out.length - 1].role === role) {
      const last = out[out.length - 1].content;
      if (typeof last === 'string') {
        out[out.length - 1].content = last + '\n\n' + text;
      } else {
        out.push({ role, content: text });
      }
    } else {
      out.push({ role, content: text });
    }
  }
  if (out.length > 0 && out[out.length - 1].role === 'user') {
    const last = out[out.length - 1].content;
    if (typeof last === 'string') {
      out[out.length - 1].content = last + '\n\n' + currentMessage;
    } else {
      out.push({ role: 'user', content: currentMessage });
    }
  } else {
    out.push({ role: 'user', content: currentMessage });
  }
  return out;
}
```

Notes:
- Imports `getCurrentFinancialMonth`, `getFinancialMonthRange` từ `shared/common/date-helpers.ts` (existing).
- Uses `TransactionsService.listForUser` (đã có thêm `categoryId` filter từ task trước).
- `goals.service.ts:39` exposes `listForUser`, `funds.service.ts:67` exposes `listForUser`, `important-dates.service.ts:122` exposes `listUpcoming(familyId, limit)` returning `UpcomingView` với property `items`.
- `tasks.service.ts:102` exposes `list(user, week?)` — không truyền week → default current.
- Privacy enforcement: `scopedFundIds()` returns chỉ funds in scope; tools double-filter results.

- [ ] **Step 2: Build**

Run: `cd /Users/manhvd/Desktop/concord && pnpm --filter api build`
Expected: no TypeScript errors. (Module DI chưa setup → runtime sẽ fail, nhưng build OK.)

If TS reports `listForUser`/`listUpcoming`/`list` signature mismatch: open the service file at the line above and adjust imports/parameter names to match the actual exported signature. Report mismatch and stop if more than ad-hoc rename needed.

- [ ] **Step 3: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/api/src/agent/subagents/answerer/answerer.subagent.ts
git commit -m "feat(api): add AnswererSubagent with 6 read-only tools"
```

---

### Task 5: Register new subagents in AgentModule

**Files:**
- Modify: `apps/api/src/agent/agent.module.ts`

- [ ] **Step 1: Update module**

Replace `apps/api/src/agent/agent.module.ts` entire file:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../modules/categories/categories.module';
import { Category } from '../modules/categories/entities/category.entity';
import { DebtsModule } from '../modules/debts/debts.module';
import { Debt } from '../modules/debts/entities/debt.entity';
import { Family } from '../modules/families/entities/family.entity';
import { Fund } from '../modules/funds/entities/fund.entity';
import { FundsModule } from '../modules/funds/funds.module';
import { GoalsModule } from '../modules/goals/goals.module';
import { ImportantDate } from '../modules/important-dates/entities/important-date.entity';
import { ImportantDatesModule } from '../modules/important-dates/important-dates.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { TasksModule } from '../modules/tasks/tasks.module';
import { TransactionsModule } from '../modules/transactions/transactions.module';
import { AnthropicService } from './core/anthropic.service';
import { AnswererSubagent } from './subagents/answerer/answerer.subagent';
import { ParserSubagent } from './subagents/parser/parser.subagent';
import { RouterSubagent } from './subagents/router/router.subagent';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fund, Category, ImportantDate, Debt, Family]),
    TransactionsModule,
    CategoriesModule,
    DebtsModule,
    FundsModule,
    GoalsModule,
    ImportantDatesModule,
    ReportsModule,
    TasksModule,
  ],
  providers: [AnthropicService, ParserSubagent, RouterSubagent, AnswererSubagent],
  exports: [
    AnthropicService,
    ParserSubagent,
    RouterSubagent,
    AnswererSubagent,
  ],
})
export class AgentModule {}
```

- [ ] **Step 2: Build**

Run: `cd /Users/manhvd/Desktop/concord && pnpm --filter api build`
Expected: no TS errors.

If a circular dependency arises (eg ReportsModule already imports something that imports AgentModule indirectly), inspect:
```bash
grep -rn "AgentModule" /Users/manhvd/Desktop/concord/apps/api/src/modules
```
We expect AgentModule imported only by ChatModule. If a module imports AgentModule that we now want to import back, surface and stop.

- [ ] **Step 3: Verify modules export the services we need**

Run:
```bash
grep -n "exports" /Users/manhvd/Desktop/concord/apps/api/src/modules/{funds,goals,important-dates,reports,tasks,transactions}/*.module.ts
```
Expected: each module exports its `XxxService` (eg `exports: [FundsService]`). If any does not, open that module and add the service to the `exports` array — `AgentModule` cannot inject a service from a module that doesn't export it. Add export, re-run build.

- [ ] **Step 4: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/api/src/agent/agent.module.ts apps/api/src/modules
git commit -m "feat(api): register router/answerer subagents in AgentModule"
```

---

### Task 6: Wire ChatService to use Router → dispatch

**Files:**
- Modify: `apps/api/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Update ChatService**

Replace `apps/api/src/modules/chat/chat.service.ts` entire file:

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswererSubagent } from '../../agent/subagents/answerer/answerer.subagent';
import { ParserSubagent } from '../../agent/subagents/parser/parser.subagent';
import { RouterSubagent } from '../../agent/subagents/router/router.subagent';
import { Fund } from '../funds/entities/fund.entity';
import { User } from '../users/entities/user.entity';
import { ChatSessionsService } from './chat-sessions.service';
import type { ChatRequestDto, ChatResponseDto } from './chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly router: RouterSubagent,
    private readonly parser: ParserSubagent,
    private readonly answerer: AnswererSubagent,
    private readonly sessions: ChatSessionsService,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
  ) {}

  private async resolveDefaultFundName(
    visibility: 'private' | 'public',
    user: User,
  ): Promise<string | undefined> {
    if (visibility === 'private') {
      const fund = await this.fundRepo.findOne({
        where: {
          familyId: user.familyId!,
          type: 'personal',
          ownerId: user.id,
          purpose: 'spending',
        },
      });
      return fund?.name;
    }
    const fund = await this.fundRepo.findOne({
      where: { familyId: user.familyId!, type: 'joint', purpose: 'spending' },
    });
    return fund?.name;
  }

  async handle(dto: ChatRequestDto, user: User): Promise<ChatResponseDto> {
    if (!dto.sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const session = await this.sessions.findAccessible(user, dto.sessionId);
    const sessionId = session.id;
    const defaultFundName = await this.resolveDefaultFundName(
      session.visibility,
      user,
    );
    const history = await this.sessions.recentMessages(sessionId, 20);

    const userMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'user',
      dto.message,
    );
    await this.sessions.maybeSetTitle(sessionId, dto.message);

    const route = await this.router.classify(dto.message, history);
    this.logger.debug(
      `router → ${route.intent} (${route.reason ?? 'no reason'}) [session ${sessionId}]`,
    );

    let reply: string;
    let actions: ChatResponseDto['actions'] = [];
    let stopReason: string | null = null;
    let usage = { inputTokens: 0, outputTokens: 0 };

    if (route.intent === 'action') {
      const result = await this.parser.parse(dto.message, user, {
        defaultFundName,
        history,
      });
      reply = result.reply;
      actions = result.actions;
      stopReason = result.stopReason;
      usage = result.usage;
    } else {
      const scope = session.visibility === 'private' ? 'personal' : 'joint';
      const result = await this.answerer.answer(dto.message, user, scope, history);
      reply = result.reply;
      stopReason = result.stopReason;
      usage = result.usage;
    }

    const totalUsage = {
      inputTokens: usage.inputTokens + route.usage.inputTokens,
      outputTokens: usage.outputTokens + route.usage.outputTokens,
    };

    const agentMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'agent',
      reply,
      actions,
      totalUsage,
    );

    return {
      reply,
      actions,
      stopReason,
      usage: totalUsage,
      sessionId,
      userMessageId: userMsg.id,
      agentMessageId: agentMsg.id,
    };
  }
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/manhvd/Desktop/concord && pnpm --filter api build`
Expected: no TS errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/manhvd/Desktop/concord
git add apps/api/src/modules/chat/chat.service.ts
git commit -m "feat(api): chat dispatches via router to parser or answerer"
```

---

### Task 7: Smoke tests

**Files:**
- Modify environment / DB locally to verify.

These are runtime checks, not unit tests. Anthropic SDK calls require `ANTHROPIC_API_KEY` set; assume that's already configured locally.

- [ ] **Step 1: Start API**

```bash
cd /Users/manhvd/Desktop/concord
pnpm --filter api start:dev
```

Wait for "Nest application successfully started".

- [ ] **Step 2: Get a JWT for testing**

You can either:
- Login through the web UI and copy the token from `localStorage.concord_access_token` in the browser devtools.
- Or hit `POST /api/auth/login` with seed credentials.

Export it:
```bash
export TOKEN='<your_jwt>'
```

- [ ] **Step 3: Create a public session and ask a question**

```bash
SESSION=$(curl -sS -X POST http://localhost:3001/api/chat/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility":"public"}' | jq -r '.id')
echo "session: $SESSION"

curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"message\":\"Tháng này chi Ăn ngoài bao nhiêu?\"}" | jq
```

Expected: `reply` contains a number with VND format (e.g. "1.217.000đ" or "0đ"). `actions` is `[]`. `stopReason` is `"end_turn"`. No `tool_error`.

- [ ] **Step 4: Try an action message in the same session**

```bash
curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"message\":\"trưa nay 50k phở\"}" | jq
```

Expected: `reply` confirms a logged transaction. `actions[]` contains a `kind: 'logged'` entry. (Router classified as `action`, dispatched to Parser.)

- [ ] **Step 5: Create a private session and verify privacy refusal**

```bash
PRIV=$(curl -sS -X POST http://localhost:3001/api/chat/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility":"private"}' | jq -r '.id')

curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$PRIV\",\"message\":\"Vợ tôi chi bao nhiêu tháng này?\"}" | jq
```

Expected: `reply` refers to "chat riêng" or "chat chung" — Answerer refused to give cross-user data.

- [ ] **Step 6: Verify the same private session can answer about own data**

```bash
curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$PRIV\",\"message\":\"Quỹ riêng của tôi còn bao nhiêu?\"}" | jq
```

Expected: `reply` contains the user's personal fund balance.

- [ ] **Step 7: Verify other Q&A surfaces**

```bash
curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"message\":\"Tuần này tôi có việc gì?\"}" | jq

curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"message\":\"Sinh nhật gần nhất là khi nào?\"}" | jq

curl -sS -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"message\":\"Mục tiêu năm tiến độ thế nào?\"}" | jq
```

Expected: each reply pulls from real data; no tool_error.

- [ ] **Step 8: Document any failures**

If any step's expectation doesn't match:
1. Note the failing message, intent, expected vs actual.
2. Check server logs (`pnpm --filter api start:dev` terminal) for router decision + tool calls.
3. Common issues:
   - Router misclassified → tweak skill examples (Task 1) and re-run.
   - Tool returned `error` → service signature mismatch; check imports in `answerer.subagent.ts`.
   - Answerer ignored tool output → strengthen skill prompt rule "trả lời từ tool data".

Don't commit changes from this task — just verify. Any fix should go in its own commit referencing the task it amends.

---

## Self-Review

**Spec coverage:**

- ✅ Router + 2 subagents architecture → Tasks 2, 4, 6.
- ✅ Router classification action/question → Task 2.
- ✅ 6 read-only tools → Task 3 (schemas) + Task 4 (handlers).
- ✅ Privacy scope from session.visibility → Task 6 wiring + Task 4 `scopedFundIds()`.
- ✅ Refuse cross-user queries in private sessions → Task 1 skill examples + Task 7 verification.
- ✅ Empty data → action suggestion → Task 1 skill examples.
- ✅ Beyond MVP messaging (multi-month) → Task 1 skill.
- ✅ Backward compat (Parser action lane unchanged) → Task 6 dispatch.
- ✅ Prompt caching for skill → Task 2 + Task 4 use `cache_control: ephemeral`.
- ✅ Sonnet for answerer / Haiku for router → Task 2 `fastModel`, Task 4 `defaultModel`.
- ✅ Single-month MVP scope → Task 3 tool schemas only take `year/month`.
- ✅ No FE / no schema changes → no FE tasks present.
- ✅ Unit tests called out as risk: skipped to keep MVP fast; smoke tests in Task 7 give end-to-end coverage.

**Placeholder scan:** no TBD/TODO/"implement later". Every code block is complete.

**Type consistency:**
- `RouteIntent = 'action' | 'question'` — defined in `router.tools.ts` (Task 2), consumed in `chat.service.ts` (Task 6 via `route.intent === 'action'`).
- `AnswererScope = 'personal' | 'joint'` — defined in `answerer.tools.ts` (Task 3), consumed in `answerer.subagent.ts` (Task 4) and `chat.service.ts` (Task 6 `session.visibility === 'private' ? 'personal' : 'joint'`).
- `AnswerResult.reply: string` (Task 4) → `chat.service.ts` writes to `agentMsg.text` (Task 6).
- `usage` shape `{ inputTokens, outputTokens }` consistent between Router (Task 2), Answerer (Task 4), Parser (existing), aggregated in Task 6.

Plan complete.
