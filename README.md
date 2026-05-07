# Concord

> Couple finance agent — track expenses across 3 funds (husband / wife / joint),
> get AI advice, hit your savings goal.

Built with **NextJS + NestJS + TypeORM + Claude Agent SDK** as a hands-on
exercise in the full Claude Code feature set.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for Postgres + Redis)
- An Anthropic API key

## Setup

```bash
# 1. Clone and install
pnpm install

# 2. Configure environment
cp .env.example .env
# → edit .env and set ANTHROPIC_API_KEY, JWT_SECRET, NEXTAUTH_SECRET

# 3. Start infrastructure (Postgres + Redis)
docker compose up -d

# 4. Run database migrations + seed
pnpm --filter api migration:run
pnpm --filter api seed

# 5. Start dev servers
pnpm dev          # runs api (http://localhost:3001) and web (http://localhost:3000)
```

Sau khi seed, có 2 tài khoản hard-coded để đăng nhập (xem [apps/api/src/seed.ts](apps/api/src/seed.ts) để biết email/password mặc định, đổi password sau lần login đầu).

## Working with Claude Code

Project có sẵn slash commands + subagent ở `.claude/`:

- `/gen-api-module <name>` — scaffold NestJS module đúng convention
- `/gen-ui-page <route>` — tạo page Next App Router + fetcher
- `/db-migrate <name>` — generate migration, review trước khi run
- `/commit` — group changes thành commit nhỏ, message conventional
- `privacy-guard-reviewer` — subagent kiểm tra privacy invariant trước merge

Convention chi tiết: [CLAUDE.md](CLAUDE.md), [apps/api/CLAUDE.md](apps/api/CLAUDE.md), [apps/web/CLAUDE.md](apps/web/CLAUDE.md).

## Project layout

```
concord/
├── apps/
│   ├── api/           NestJS API + Claude Agent SDK + BullMQ workers
│   └── web/           NextJS 15 UI
├── packages/
│   ├── db/            Shared TypeORM entities + migrations
│   └── shared/        Shared DTOs / types
├── docker-compose.yml Postgres (pgvector) + Redis
└── CLAUDE.md          Project context for Claude Code
```

## Useful scripts

```bash
pnpm dev:api         # run only the NestJS API
pnpm dev:web         # run only the NextJS web app
pnpm db:up           # start postgres + redis
pnpm db:down         # stop postgres + redis
pnpm build           # build both apps
pnpm lint            # lint everything
```

### Maintenance

```bash
# Wipe transactions + chat history, keep users/funds/categories/goals
pnpm --filter api reset:txn                      # full reset (balance = 0)
pnpm --filter api reset:txn -- --keep-opening    # keep opening-balance entries
pnpm --filter api reset:txn -- --drop-envelopes  # also delete envelope funds

# Re-seed defaults (categories, demo users, fund skeleton)
pnpm --filter api seed
```

## Design notes

See `CLAUDE.md` for architecture, business rules, and conventions.
The full implementation plan lives in
`/Users/manhvd/.claude/plans/b-y-gi-t-i-mu-n-curious-wind.md`.
