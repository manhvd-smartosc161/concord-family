# `apps/api` — Concord NestJS API

NestJS 11 + TypeORM 0.3 + Anthropic SDK. Đây là module-level guide; quy ước
chung của project xem `concord/CLAUDE.md`.

## Layout (feature-first)

```
apps/api/
├── src/
│   ├── main.ts, app.module.ts, seed.ts, data-source.ts
│   ├── infra/
│   │   └── database/database.module.ts
│   ├── shared/                   cross-cutting infrastructure
│   │   ├── common/
│   │   │   ├── base.entity.ts    id (uuid) + createdAt + updatedAt
│   │   │   └── transformers.ts   bigintTransformer, ...
│   │   ├── auth/                 JWT + Passport (cross-cutting, không phải feature)
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── decorators/current-user.decorator.ts
│   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   ├── strategies/jwt.strategy.ts
│   │   │   └── dto/{login,change-password}.dto.ts
│   │   ├── guards/               (placeholder cho privacy guard sau)
│   │   ├── decorators/, filters/, interceptors/   (placeholder, dùng khi cần)
│   ├── modules/                  feature flat (không layer subdivision)
│   │   ├── users/                <name>.module + <name>.service + dto/ + entities/
│   │   ├── salary-rules/         tách khỏi users, module riêng
│   │   ├── funds/, transactions/, categories/, chat/, goals/, reports/
│   │   ├── insights/             entities-only (chưa có module)
│   │   └── budgets/              entities-only (chưa có module)
│   └── agent/                    Anthropic SDK orchestrator (cross-feature)
│       ├── agent.module.ts
│       ├── core/anthropic.service.ts
│       └── subagents/
│           └── parser/           mỗi subagent 1 folder
│               ├── parser.subagent.ts
│               ├── parser.tools.ts
│               └── skill.md
└── migrations/                   ngoài src/, build không touch
```

## Khi tạo module mới

1. Tạo folder `src/modules/<name>/` với 5 thứ: `<name>.module.ts`,
   `<name>.controller.ts`, `<name>.service.ts`, `dto/`, `entities/`.
2. Entity extend `BaseEntity` từ `src/shared/common/base.entity.ts`.
3. Module dùng `TypeOrmModule.forFeature([Entity1, Entity2])` trong `imports`.
4. Đăng ký module trong `src/app.module.ts` (`imports: [..., NewModule]`).
5. Đăng ký entity mới trong `src/data-source.ts` array `entities`.
6. Nếu đổi entity: `/db-migrate <name>` để generate migration.

Pattern controller chuẩn:

```ts
@UseGuards(JwtAuthGuard)
@Controller('api/<resource>')
export class FooController {
  constructor(private readonly fooService: FooService) {}

  @Get()
  list(@CurrentUser() user: User, @Query(...) ...): Promise<FooView[]> {
    return this.fooService.listForUser(user, ...);
  }
}
```

Pattern này có sẵn trong `modules/transactions/`, `modules/funds/`, `modules/goals/`
— khi mới tạo module, copy 1 trong số đó làm template.

Khi 1 module phình lớn (>10 file), cân nhắc tách thành 4 layer:
`<module>/{domain,application,infrastructure,interface}/`. Hiện tại flat đủ.

## Privacy enforcement (load-bearing)

Mọi service/route đụng `Transaction` hoặc `Fund` phải tự enforce per-user access.
Pattern hiện dùng (xem `modules/transactions/transactions.service.ts`):

```ts
async visibleFundIds(user: User): Promise<string[]> {
  const funds = await this.fundRepo.find({
    where: [{ ownerId: user.id }, { ownerId: IsNull() }],
  });
  return funds.map((f) => f.id);
}
```

Rồi trong query: `.where('fund_id IN (:...fundIds)', { fundIds })`.

Khi write/update/delete: check thêm
`fund.type === 'personal' && fund.ownerId !== user.id` → `ForbiddenException`.

**KHÔNG bypass** cho "agent context" — subagent phải gọi service method có user
context, không truy cập repo trực tiếp.

## DTO + validation

- Dùng `class-validator` + `class-transformer`.
- `main.ts` đã set `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Money fields: `@IsInt()` + `@Min(...)` — không bao giờ `@IsNumber()` raw.
- Date fields nhận từ client: `@IsISO8601()` rồi service tự `new Date(...)`.

## TypeORM

- `data-source.ts` là single source of truth cho CLI.
- KHÔNG dùng `synchronize: true`. Tất cả schema change qua migration.
- Migrations sống ở `apps/api/migrations/` (ngoài `src/`).
- Workflow:
  1. Sửa entity
  2. `pnpm --filter api migration:generate migrations/<Name>` — generate
  3. Mở file migration, kiểm tra SQL
  4. `pnpm --filter api migration:run` — apply

## Anthropic / Agent

- Default model: `claude-sonnet-4-6` (`process.env.ANTHROPIC_DEFAULT_MODEL`).
- Fast model: `claude-haiku-4-5-20251001` cho parser/categorizer.
- Mỗi subagent là 1 folder `agent/subagents/<name>/` chứa:
  - `<name>.subagent.ts` — class `@Injectable()` wrap Anthropic SDK call
  - `<name>.tools.ts` — function-calling tool definitions + types
  - `skill.md` — system prompt
- Skill file load qua `path.join(__dirname, 'skill.md')` (sibling).
- `nest-cli.json` asset glob `agent/subagents/**/skill.md` → tự copy ra `dist/`.
- Cache phần static của prompt (`cache_control: { type: 'ephemeral' }`).

## Test

- `pnpm --filter api test` chạy Jest. File đặt cạnh source: `*.spec.ts`.

## Anti-patterns thường gặp với Claude Code

- ❌ Tạo file vào `packages/db` — chưa tồn tại; entity ở `src/modules/<x>/entities/`.
- ❌ Tạo `src/workers/` — BullMQ chưa cài.
- ❌ Import từ `@concord/shared` — package chưa tồn tại.
- ❌ Dùng `synchronize: true` để bypass migration.
- ❌ Floating point cho VND.
- ❌ Bypass privacy check trong service.
- ❌ Tạo module mới ngoài `src/modules/` — tất cả feature module phải dưới `modules/`.
- ❌ Subagent inject repo trực tiếp — phải gọi service method có user context.

## Run

```bash
pnpm --filter api start:dev      # http://localhost:3001
pnpm --filter api migration:run
pnpm --filter api seed
pnpm --filter api lint
pnpm --filter api test
```

## Maintenance scripts (`src/scripts/`)

- **`reset:txn`** — `pnpm --filter api reset:txn [-- --keep-opening] [-- --drop-envelopes]`
  - Xoá transactions + chat sessions/messages, reset `funds.balance`.
  - Giữ users, fund entities, categories, salary rules, goals.
  - `--keep-opening`: giữ entry số dư khởi điểm (`__opening_balance__`), balance recompute từ chúng.
  - `--drop-envelopes`: xoá luôn các fund với `purpose='envelope'` (du lịch, đầu tư…).
  - Source: `src/scripts/reset-transactions.ts`. Khi cần reset state để demo/test, dùng cái này.
