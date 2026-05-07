# `apps/api` — Concord NestJS API

NestJS 11 + TypeORM 0.3 + Anthropic SDK. Đây là module-level guide; quy ước
chung của project xem `concord/CLAUDE.md`.

## Layout

```
apps/api/src/
├── <module>/                  một feature module
│   ├── <module>.module.ts
│   ├── <module>.controller.ts
│   ├── <module>.service.ts
│   ├── dto/                   class-validator DTOs (1 file/DTO)
│   └── entities/              TypeORM entities (1 file/entity)
├── auth/                      JWT auth + Passport, decorators, guards
│   ├── decorators/current-user.decorator.ts
│   ├── guards/jwt-auth.guard.ts
│   └── strategies/jwt.strategy.ts
├── agent/                     Anthropic SDK orchestrator
│   ├── agent.module.ts
│   ├── anthropic.service.ts
│   ├── skills/                Skill markdown files (system prompts cho subagent)
│   ├── subagents/             1 subagent / file (parser, categorizer, ...)
│   └── tools/                 function-calling tool definitions + types
├── common/
│   ├── base.entity.ts         id (uuid) + createdAt + updatedAt
│   └── transformers.ts        TypeORM column transformers
├── database/database.module.ts
├── migrations/                TypeORM migration files
├── data-source.ts             dùng cho CLI typeorm
├── main.ts                    bootstrap, CORS, ValidationPipe
└── seed.ts                    pnpm seed
```

## Khi tạo module mới

1. Tạo folder `src/<name>/` với 5 thứ: `<name>.module.ts`, `<name>.controller.ts`,
   `<name>.service.ts`, `dto/`, `entities/`.
2. Entity extend `BaseEntity` từ `src/common/base.entity.ts` (id uuid + timestamp).
3. Module dùng `TypeOrmModule.forFeature([Entity1, Entity2])` trong `imports`,
   `controllers: [...]`, `providers: [Service]`, `exports: [Service]` nếu module
   khác cần inject.
4. Đăng ký module trong `src/app.module.ts` (`imports: [..., NewModule]`).
5. Nếu cần chạy migration sau khi đổi entity: `/db-migrate <name>`.

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

Pattern này có sẵn trong `transactions/`, `funds/`, `goals/` — khi mới tạo
module, copy 1 trong số đó làm template.

## Privacy enforcement (load-bearing)

Mọi service/route đụng `Transaction` hoặc `Fund` phải tự enforce per-user access.
Pattern hiện dùng (xem `transactions.service.ts` để có example chi tiết):

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
- `main.ts` đã set `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`,
  nên DTO chỉ cần khai property + decorator. Property không khai sẽ bị strip.
- Money fields: `@IsInt()` + `@Min(...)` (không bao giờ `@IsNumber()` raw vì float trượt).
- Date fields nhận từ client: `@IsISO8601()` rồi service tự `new Date(...)`.

## TypeORM

- `data-source.ts` là single source of truth cho CLI (`migration:generate`, `migration:run`).
- KHÔNG dùng `synchronize: true`. Tất cả schema change qua migration.
- Workflow:
  1. Sửa entity
  2. `pnpm --filter api migration:generate src/migrations/<name>` — generate
  3. Mở file migration, kiểm tra SQL trước khi commit
  4. `pnpm --filter api migration:run` — apply
- Money column dùng `bigint` hoặc `int` + transformer trong `common/transformers.ts`
  để TypeScript thấy `number`, Postgres lưu integer.

## Anthropic / Agent

- Default model: `claude-sonnet-4-6` (`process.env.ANTHROPIC_DEFAULT_MODEL`).
- Fast model: `claude-haiku-4-5-20251001` cho parser/categorizer (nhanh + rẻ).
- Skill files (`agent/skills/*.md`) là system prompt — chỉnh prompt KHÔNG cần
  đụng code TS.
- Subagent code (`agent/subagents/*.ts`) chỉ wrap: load skill markdown + define tool
  schema + call Anthropic SDK. Logic business gọi service ở module tương ứng.
- Cache phần static của prompt (`cache_control: { type: 'ephemeral' }`).

## Test

- `pnpm --filter api test` chạy Jest. Test file đặt cạnh source: `*.spec.ts`.
- Hiện chỉ có `app.controller.spec.ts` mẫu — khi thêm logic phức tạp, viết test.

## Anti-patterns thường gặp với Claude Code

- ❌ Tạo file vào `packages/db` — chưa tồn tại, entity ở `apps/api/src/<module>/entities/`.
- ❌ Tạo `src/workers/` — BullMQ chưa cài, đừng scaffold trước khi user yêu cầu.
- ❌ Import từ `@concord/shared` — package chưa tồn tại.
- ❌ Dùng `synchronize: true` để bypass migration.
- ❌ Floating point cho VND.
- ❌ Bypass privacy check trong service.
- ❌ Thêm global `PrivacyFilterGuard` mà không update tất cả service đang enforce inline (sẽ double-check).

## Run

```bash
pnpm --filter api start:dev      # http://localhost:3001
pnpm --filter api migration:run
pnpm --filter api seed
pnpm --filter api lint
pnpm --filter api test
```
