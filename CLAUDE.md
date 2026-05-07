# Concord — Couple Finance Agent

## What this project is

Concord là personal finance agent dành cho cặp đôi. Track chi tiêu trên **3 quỹ**
(chồng, vợ, chung) và đưa ra advice (AI) hướng tới mục tiêu tiết kiệm năm
**100–200M VND**.

Project song song là vehicle để học toàn bộ feature set của Claude Code (Skills,
Subagents, Hooks, MCP, Multi-agent, Background, Worktrees, Agent SDK).

## Tech stack (thực tế hiện tại)

- **Frontend**: NextJS 16 (App Router) + Tailwind v4 + Recharts — `apps/web`
  - shadcn/ui: **planned**, chưa setup. Component hiện tự viết trong `app/(authed)/_components/`.
- **Backend**: NestJS 11 (modules + DI + decorators) — `apps/api`
- **DB**: PostgreSQL 16 + pgvector + TypeORM 0.3
- **AI**: Anthropic SDK (TypeScript) — Sonnet 4.6 default, Haiku 4.5 cho parser/categorizer
- **Auth**: JWT-only (Passport-JWT trên api, token lưu localStorage trên web qua `lib/api.ts`).
  NextAuth: **planned**, chưa dùng — biến `NEXTAUTH_*` trong `.env` chỉ dùng cho CORS origin.
- **Background**: BullMQ + Redis — **planned**, chưa cài. `docker-compose.yml` đã có Redis sẵn.
- **Deploy**: Docker Compose, self-hosted

## Layout (thực tế)

```
concord/
├── apps/
│   ├── api/          NestJS API + Anthropic SDK orchestrator (xem apps/api/CLAUDE.md)
│   └── web/          NextJS 16 UI                            (xem apps/web/CLAUDE.md)
├── packages/         (rỗng — placeholder cho db/shared khi cần tách)
├── docker-compose.yml
└── CLAUDE.md         (file này)
```

`packages/db` và `packages/shared` từng được plan nhưng hiện chưa tách —
entity sống trong `apps/api/src/<module>/entities/`, type chia sẻ giữa web/api
được duplicate trong `apps/web/lib/api.ts`. Khi codebase đủ lớn để cần tách,
thêm chúng vào đây và cập nhật pnpm-workspace.yaml.

## Business rules (load-bearing — không được vi phạm)

- **Three funds**: Mạnh (chồng cá nhân), Wife cá nhân, Joint (chung).
- **Privacy**: mỗi user chỉ thấy giao dịch trong (quỹ cá nhân của họ) ∪ (quỹ chung).
  Subagent thấy toàn bộ funds để generate insight cross-fund — nhưng UI output
  phải KHÔNG BAO GIỜ expose raw cross-fund transactions, chỉ aggregate ẩn danh.
- **Income** chảy vào → auto-allocate sang 3 quỹ theo % user-set (`salary-rules`).
- **Money** lưu integer VND (không decimal; 200,000đ → 200000).
- **Locale**: timestamp lưu UTC; input/display Asia/Ho_Chi_Minh.
- Default categories là **tiếng Việt** (Ăn ngoài, Cà phê, Đi lại, Điện nước, Con cái, ...).
- Mọi route đụng transaction PHẢI enforce privacy. Hiện tại enforcement nằm
  inline trong service (`visibleFundIds()` + check `fund.type === 'personal' && fund.ownerId !== user.id`).
  Khi thêm route mới đụng transaction/fund, follow pattern này — đừng bypass cho "tiện".
  (Một global `PrivacyFilterGuard` trong `src/common/guards/` từng được plan nhưng
  chưa implement; tạo nó là một improvement đáng làm sau.)

## Conventions

- Subagent system prompt sống trong `apps/api/src/agent/skills/*.md` và load
  như Skill files. Giữ ở Markdown để dễ version-control + edit không đụng code.
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

Xem `README.md` cho full setup. Convention chi tiết per-app:
- API: [apps/api/CLAUDE.md](apps/api/CLAUDE.md)
- Web: [apps/web/CLAUDE.md](apps/web/CLAUDE.md)

## Slash commands & subagent (project-scope)

- `/gen-api-module <name>` — scaffold 1 NestJS module đúng pattern Concord
- `/gen-ui-page <route>` — tạo page Next App Router trong `(authed)/<route>` + fetcher
- `/db-migrate <name>` — generate migration, nhắc review trước khi run
- `/commit` — group changes thành commit nhỏ, message conventional, không commit `.env`
- `privacy-guard-reviewer` (subagent) — review diff để bắt route/service đụng
  transaction mà bypass privacy check
