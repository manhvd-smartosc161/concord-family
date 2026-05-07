# Concord — Couple Finance Agent

## What this project is

Concord là personal finance agent dành cho cặp đôi. Track chi tiêu trên **3 quỹ**
(chồng, vợ, chung) và đưa ra advice (AI) hướng tới mục tiêu tiết kiệm năm
**100–200M VND**.

Project song song là vehicle để học toàn bộ feature set của Claude Code (Skills,
Subagents, Hooks, MCP, Multi-agent, Background, Worktrees, Agent SDK).

## Tech stack

- **Frontend**: NextJS 16 (App Router) + Tailwind v4 + Recharts — `apps/web`
  - shadcn/ui: planned, chưa setup. Component hiện tự viết trong `components/ui/`.
- **Backend**: NestJS 11 (modules + DI + decorators) — `apps/api`
- **DB**: PostgreSQL 16 + pgvector + TypeORM 0.3
- **AI**: Anthropic SDK (TypeScript) — Sonnet 4.6 default, Haiku 4.5 cho parser/categorizer
- **Auth**: JWT-only. Token lưu localStorage (web) → `Authorization: Bearer` (api).
- **Background**: BullMQ + Redis — planned, chưa cài.
- **Deploy**: Docker Compose, self-hosted

## Architecture (feature-first modular)

```
concord/
├── apps/
│   ├── api/          NestJS (xem apps/api/CLAUDE.md)
│   └── web/          NextJS  (xem apps/web/CLAUDE.md)
└── docker-compose.yml
```

Cả 2 app organize theo **feature-first**: mỗi feature là 1 vertical slice tự chứa
(API contracts, types, components, business logic). Cross-cutting infrastructure
(auth, UI primitives, layout chrome) sống trong `shared/` (BE) hoặc `components/`
(FE).

## Business rules (load-bearing — không được vi phạm)

- **Three spending funds**: Mạnh (chồng cá nhân), Wife cá nhân, Joint/Chung — đây là **quỹ chi tiêu**
  (`purpose='spending'`). Dòng tiền liên tục: lương về, chi tiêu hằng ngày, chuyển nội bộ giữa các quỹ.
  **Không thể archive**. Không tạo thêm spending fund — 3 cái này là cố định.

- **Savings & Investment funds** (`purpose='savings'` hoặc `purpose='investment'`): quỹ mục tiêu tĩnh
  (du lịch, mua xe, đầu tư chứng khoán...). Không có income trực tiếp — chỉ nhận tiền qua
  "Chuyển nội bộ" từ quỹ chi tiêu. Có thể tạo/archive/unarchive tự do. Hiện tại luôn là `type='joint'`
  (không có savings fund riêng cá nhân).

- **Annual savings goal progress** = net inflow vào toàn bộ savings + investment funds trong năm.
  **KHÔNG phải** thu/chi của Quỹ Chung. "Chuyển nội bộ" vào savings fund CHÍNH LÀ hành động tiết kiệm —
  không loại bỏ nó. Opening balance (`__opening_balance__`) bị loại để tránh double-count.
  Logic nằm tại `GoalsService.computeProgress()` (goals.service.ts).

- **Privacy**: mỗi user chỉ thấy giao dịch trong (quỹ cá nhân của họ) ∪ (quỹ chung).
  Subagent thấy toàn bộ funds để generate insight cross-fund — nhưng UI output
  phải KHÔNG BAO GIỜ expose raw cross-fund transactions, chỉ aggregate ẩn danh.
- **Income** allocation: BE module `salary-rules` tồn tại để chia lương theo % vào quỹ riêng + chung, nhưng FE UI đã drop. Hiện tại không có flow log lương qua chat dùng rule này; có thể wire lại sau hoặc xoá module nếu permanent.
- **Money** lưu integer VND (không decimal; 200,000đ → 200000).
- **Locale**: timestamp lưu UTC; input/display Asia/Ho_Chi_Minh.
- Default categories tiếng Việt (Ăn ngoài, Cà phê, Đi lại, Điện nước, Con cái, ...).
- Mọi route đụng transaction PHẢI enforce privacy. Hiện tại enforcement nằm
  inline trong service (`visibleFundIds()` + check `fund.type === 'personal' && fund.ownerId !== user.id`).
  Khi thêm route mới đụng transaction/fund, follow pattern này — đừng bypass cho "tiện".
  (Một global `PrivacyFilterGuard` trong `src/shared/guards/` từng được plan nhưng
  chưa implement; tạo nó là một improvement đáng làm sau.)

## Conventions

- Subagent system prompt sống trong `apps/api/src/agent/subagents/<name>/skill.md`
  và load như Skill files. Giữ ở Markdown để dễ version-control + edit không đụng code.
- Dùng **Haiku 4.5** cho parsing/classification hẹp; **Sonnet 4.6** cho reasoning
  (advisor, reporter, anomaly, big-buy).
- Luôn cache phần static của system prompt (Anthropic prompt caching) — monthly
  report rẻ khi 80% prompt đã cache.
- Money trong code: `number` integer (VND). Không bao giờ floating point.

## Development

```bash
docker compose up -d        # postgres + redis
pnpm install                # install all workspace deps
cp .env.example .env        # rồi điền ANTHROPIC_API_KEY, JWT_SECRET, NEXTAUTH_SECRET
pnpm --filter api migration:run
pnpm --filter api seed
pnpm dev                    # api (3001) + web (3000) song song
```

Convention chi tiết per-app:
- API: [apps/api/CLAUDE.md](apps/api/CLAUDE.md)
- Web: [apps/web/CLAUDE.md](apps/web/CLAUDE.md)

## Slash commands & subagent (project-scope)

- `/gen-api-module <name>` — scaffold 1 NestJS module trong `src/modules/<name>/`
- `/gen-ui-page <route>` — tạo page Next App Router + feature slice (api/types/components)
- `/db-migrate <name>` — generate migration vào `apps/api/migrations/`, nhắc review
- `/commit` — group changes thành commit nhỏ, conventional, không commit `.env`
- `privacy-guard-reviewer` (subagent) — review diff để bắt route/service đụng
  transaction mà bypass privacy check
