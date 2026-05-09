# Family Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Concord từ single-couple deployment sang multi-tenant với entity `Family` (≤2 members). Mỗi user thuộc 1 family, mọi data row scope theo `family_id`. Bao gồm registration flow, family setup, member invitation qua email link.

**Architecture:** Add `Family` + `FamilyInvitation` entities. User → Family 1-1. Add `family_id` NOT NULL column to all data tables (funds, transactions, goals, categories, important_dates, chat_sessions, yearly_ai_cache, salary_rules). JWT payload includes `familyId` cho fast guard. Wipe + restart (1 migration drop tất cả + recreate). Auto-seed 3 funds + categories + important dates khi family đủ 2 spouse.

**Tech Stack:** NestJS 11 · TypeORM 0.3 · PostgreSQL 16 · Anthropic SDK · Next.js 16 · React 19 · TypeScript

**Spec:** [docs/superpowers/specs/2026-05-09-family-multitenancy.md](../specs/2026-05-09-family-multitenancy.md)

---

## Important conventions for this plan

1. **No auto-commit**: User runs `/commit` themselves. Each task ends with a checkpoint message (no `git commit` command). Engineer leaves working tree dirty for user to review.
2. **Minimize lint/tsc runs**: Only run verification at end of major task groups (after BE schema done, after services refactor done, after FE done). Skip per-edit checks.
3. **Order matters**: Tasks 1-11 (BE) must complete before 12-19 (FE). Tasks 1-4 (schema) before 5-10 (services). Don't skip ahead.
4. **One migration**: Single big migration `1779000000000-FamilyMultiTenancy.ts` that drops everything + recreates. Don't generate multiple migrations.

---

## File structure

**New API files (8):**
- `apps/api/src/modules/families/entities/family.entity.ts`
- `apps/api/src/modules/families/entities/family-invitation.entity.ts`
- `apps/api/src/modules/families/families.module.ts`
- `apps/api/src/modules/families/families.service.ts`
- `apps/api/src/modules/families/families.controller.ts`
- `apps/api/src/modules/families/dto/create-family.dto.ts`
- `apps/api/src/modules/families/dto/create-invitation.dto.ts`
- `apps/api/src/shared/auth/guards/family-required.guard.ts`
- `apps/api/migrations/1779000000000-FamilyMultiTenancy.ts`

**Modified API files:**
- `apps/api/src/modules/users/entities/user.entity.ts` — +familyId, gender, birthdate
- `apps/api/src/modules/users/users.service.ts` — +createForRegister
- `apps/api/src/shared/auth/auth.service.ts` — +register, JWT payload
- `apps/api/src/shared/auth/auth.controller.ts` — POST /register
- `apps/api/src/shared/auth/strategies/jwt.strategy.ts` — extract familyId
- `apps/api/src/shared/auth/dto/register.dto.ts` (new in dto folder)
- `apps/api/src/data-source.ts` — register Family + FamilyInvitation
- `apps/api/src/app.module.ts` — register FamiliesModule
- `apps/api/src/seed.ts` — drop user/fund seed, keep no-op or minimal admin
- 8 entities (funds, transactions, goals, categories, important_dates, chat_sessions, yearly_ai_cache, salary_rules) — +familyId
- 8 services — scope by familyId

**New web files (5):**
- `apps/web/app/register/page.tsx`
- `apps/web/app/(authed)/family/setup/page.tsx`
- `apps/web/app/(authed)/family/invite/page.tsx`
- `apps/web/app/invite/[token]/page.tsx`
- `apps/web/features/families/api.ts`
- `apps/web/features/families/types.ts`

**Modified web files:**
- `apps/web/app/login/page.tsx` — drop demo, add register link
- `apps/web/app/(authed)/layout.tsx` — familyId guard
- `apps/web/features/auth/types.ts` — +familyId/gender/birthdate
- `apps/web/features/auth/api.ts` — +register
- `apps/web/components/layout/sidebar.tsx` — +link Family

---

## Task 0: Baseline & branch

**Files:** none

- [ ] **Step 1: Verify clean working tree on main**

```bash
cd /Users/manhvd/Desktop/concord
git status
```

Expected: clean (or commit/stash any pending work first).

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/family-multitenancy
```

- [ ] **Step 3: Verify baseline build**

```bash
pnpm --filter api lint
pnpm --filter api build
pnpm --filter web lint
```

All must pass. If api lint shows pre-existing issues, fix or note them before starting.

**Checkpoint**: Branch `feat/family-multitenancy` created from clean main, baseline passes.

---

## Task 1: Create Family + FamilyInvitation entities

**Files:**
- Create: `apps/api/src/modules/families/entities/family.entity.ts`
- Create: `apps/api/src/modules/families/entities/family-invitation.entity.ts`

- [ ] **Step 1: Write `family.entity.ts`**

```ts
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

@Entity('families')
export class Family extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'date', nullable: true, name: 'wedding_date' })
  weddingDate!: string | null;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById!: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt!: Date | null;
}
```

- [ ] **Step 2: Write `family-invitation.entity.ts`**

```ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

@Entity('family_invitations')
export class FamilyInvitation extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'uuid', unique: true })
  token!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'uuid', name: 'accepted_by_id', nullable: true })
  acceptedById!: string | null;
}
```

**Checkpoint**: 2 entity files exist with `BaseEntity` pattern (id, createdAt, updatedAt inherited).

---

## Task 2: Modify User entity (add familyId, gender, birthdate)

**Files:**
- Modify: `apps/api/src/modules/users/entities/user.entity.ts`

- [ ] **Step 1: Add columns to User entity**

Read current file first. Add these columns (keep existing `id, email, name, role, passwordHash, createdAt, updatedAt`):

```ts
@Column({ type: 'uuid', name: 'family_id', nullable: true })
familyId!: string | null;

@Column({ type: 'varchar', length: 8 })
gender!: 'male' | 'female';

@Column({ type: 'date', nullable: true })
birthdate!: string | null;
```

- [ ] **Step 2: Make `role` nullable**

Existing `role` is NOT NULL with enum. Make nullable since user mới register chưa join family chưa có role:

```ts
@Column({ type: 'enum', enum: ['husband', 'wife'], nullable: true })
role!: 'husband' | 'wife' | null;
```

**Checkpoint**: User entity has familyId (nullable uuid), gender (NOT NULL varchar), birthdate (nullable date), role (nullable enum).

---

## Task 3: Add `family_id` column to all data entities

**Files (8):**
- Modify: `apps/api/src/modules/funds/entities/fund.entity.ts`
- Modify: `apps/api/src/modules/transactions/entities/transaction.entity.ts`
- Modify: `apps/api/src/modules/goals/entities/goal.entity.ts`
- Modify: `apps/api/src/modules/categories/entities/category.entity.ts`
- Modify: `apps/api/src/modules/important-dates/entities/important-date.entity.ts`
- Modify: `apps/api/src/modules/important-dates/entities/yearly-ai-cache.entity.ts`
- Modify: `apps/api/src/modules/chat/entities/chat-session.entity.ts`
- Modify: `apps/api/src/modules/salary-rules/entities/salary-rule.entity.ts`

- [ ] **Step 1: Add column to each entity**

For each file above, add this column near the top of class body:

```ts
@Index()
@Column({ type: 'uuid', name: 'family_id' })
familyId!: string;
```

Add the import if not already present:
```ts
import { Column, Entity, Index } from 'typeorm';
```

- [ ] **Step 2: Skip `chat_messages`**

`chat_messages` table doesn't need `family_id` column directly — already inherits via `chat_session.family_id` JOIN. Leave it as is.

- [ ] **Step 3: Skip `yearly_ai_cache` if it doesn't exist as table**

Verify the entity exists in `apps/api/src/modules/important-dates/entities/yearly-ai-cache.entity.ts`. If yes, add `family_id`. The unique constraint on `year` becomes composite with `family_id`:

```ts
@Index(['familyId', 'year'], { unique: true })
@Entity('yearly_ai_cache')
export class YearlyAiCache extends BaseEntity {
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'integer' })
  year!: number;
  // ... existing items column
}
```

Drop the existing `@Index({ unique: true })` on `year` standalone if any; replace with composite.

**Checkpoint**: 8 entities have `familyId` column, indexed.

---

## Task 4: Single big migration — drop all + recreate

**Files:**
- Create: `apps/api/migrations/1779000000000-FamilyMultiTenancy.ts`
- Modify: `apps/api/src/data-source.ts` — register Family, FamilyInvitation

- [ ] **Step 1: Register new entities in data-source**

Open `apps/api/src/data-source.ts`. Add to the `entities` array:
```ts
import { Family } from './modules/families/entities/family.entity';
import { FamilyInvitation } from './modules/families/entities/family-invitation.entity';

// In entities array:
entities: [
  // ... existing entities
  Family,
  FamilyInvitation,
],
```

- [ ] **Step 2: Generate migration via TypeORM CLI**

Run from `apps/api/`:
```bash
pnpm migration:generate migrations/FamilyMultiTenancy
```

This will generate a migration file. Rename it (if needed) so timestamp is `1779000000000` for ordering.

- [ ] **Step 3: Inspect generated SQL**

Open the generated migration file. It should:
- DROP every existing data table (transactions, funds, goals, categories, important_dates, chat_sessions, chat_messages, salary_rules, yearly_ai_cache)
- DROP users table or ALTER it to add columns + make role nullable
- CREATE families, family_invitations
- CREATE all data tables with `family_id NOT NULL` + indexes + foreign keys

If the generator produces something messy (e.g. lots of separate ALTERs), simplify by writing the migration manually:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class FamilyMultiTenancy1779000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop all data tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goals" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "important_dates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "yearly_ai_cache" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "salary_rules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "funds" CASCADE`);

    // Modify users
    await queryRunner.query(`ALTER TABLE "users" ADD "family_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "gender" varchar(8) NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "birthdate" date NULL`);
    await queryRunner.query(`UPDATE "users" SET "gender" = CASE WHEN "role" = 'husband' THEN 'male' ELSE 'female' END`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "gender" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL`);

    // Create families
    await queryRunner.query(`
      CREATE TABLE "families" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "name" varchar(120) NOT NULL,
        "wedding_date" date NULL,
        "created_by_id" uuid NOT NULL,
        "completed_at" timestamptz NULL,
        CONSTRAINT "PK_families" PRIMARY KEY ("id"),
        CONSTRAINT "FK_families_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create family_invitations
    await queryRunner.query(`
      CREATE TABLE "family_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "email" varchar(320) NOT NULL,
        "token" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz NULL,
        "accepted_by_id" uuid NULL,
        CONSTRAINT "PK_family_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_family_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_invitations_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invitations_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_invitations_family" ON "family_invitations" ("family_id")`);

    // Add FK from users.family_id to families.id (after families table exists)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_family"
      FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL
    `);

    // Recreate funds with family_id
    await queryRunner.query(`
      CREATE TABLE "funds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "type" varchar(16) NOT NULL,
        "purpose" varchar(16) NOT NULL DEFAULT 'spending',
        "owner_id" uuid NULL,
        "balance" bigint NOT NULL DEFAULT 0,
        "archived_at" timestamptz NULL,
        CONSTRAINT "PK_funds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_funds_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_funds_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_funds_family" ON "funds" ("family_id")`);

    // Recreate categories with family_id
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "icon" varchar(8) NULL,
        "is_essential" boolean NOT NULL DEFAULT false,
        "parent_id" uuid NULL,
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_categories_family" ON "categories" ("family_id")`);

    // Recreate transactions with family_id
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "fund_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "category_id" uuid NULL,
        "amount" bigint NOT NULL,
        "note" text NULL,
        "raw_text" text NULL,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_family" ON "transactions" ("family_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_fund" ON "transactions" ("fund_id")`);

    // Recreate goals
    await queryRunner.query(`
      CREATE TABLE "goals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "type" varchar(16) NOT NULL,
        "period" varchar(16) NOT NULL,
        "target_amount" bigint NOT NULL,
        "start_date" timestamptz NOT NULL,
        "end_date" timestamptz NOT NULL,
        CONSTRAINT "PK_goals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_goals_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_goals_family" ON "goals" ("family_id")`);

    // Recreate important_dates
    await queryRunner.query(`
      CREATE TABLE "important_dates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "type" varchar(32) NOT NULL,
        "date" date NOT NULL,
        "is_lunar" boolean NOT NULL DEFAULT false,
        "remind_days_before" integer[] NOT NULL DEFAULT '{}',
        "notes" text NULL,
        "created_by_id" uuid NOT NULL,
        CONSTRAINT "PK_important_dates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_important_dates_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_important_dates_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_important_dates_family" ON "important_dates" ("family_id")`);

    // Recreate yearly_ai_cache
    await queryRunner.query(`
      CREATE TABLE "yearly_ai_cache" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "items" jsonb NOT NULL DEFAULT '[]',
        "generated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_yearly_ai_cache" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_yearly_ai_cache_family_year" UNIQUE ("family_id", "year"),
        CONSTRAINT "FK_yearly_ai_cache_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE
      )
    `);

    // Recreate chat_sessions + chat_messages
    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "fund_id" uuid NOT NULL,
        "title" varchar(200) NULL,
        "last_message_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_sessions_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_sessions_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_family" ON "chat_sessions" ("family_id")`);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "session_id" uuid NOT NULL,
        "role" varchar(16) NOT NULL,
        "text" text NOT NULL,
        "actions" jsonb NULL,
        "usage" jsonb NULL,
        "author_id" uuid NULL,
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_session" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_messages_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Recreate salary_rules
    await queryRunner.query(`
      CREATE TABLE "salary_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "personal_pct" integer NOT NULL DEFAULT 50,
        "joint_pct" integer NOT NULL DEFAULT 50,
        CONSTRAINT "PK_salary_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_salary_rules_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_salary_rules_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No down — destructive migration. Restore from backup if needed.
    throw new Error('FamilyMultiTenancy migration is not reversible. Restore DB from backup.');
  }
}
```

⚠️ Verify each entity's columns match its current shape. Reference the actual entity files for column names like `bigint` for money, `text` vs `varchar`, etc. Don't guess — read each entity first.

- [ ] **Step 4: Run migration**

```bash
cd apps/api
pnpm migration:run
```

Expected: migration applies cleanly. DB now has empty data tables (only users + families + family_invitations possibly with data).

- [ ] **Step 5: Truncate users (since they don't have familyId/gender set yet for fresh start)**

```bash
psql $DATABASE_URL -c 'TRUNCATE TABLE "users" CASCADE;'
```

(Or via DB tool. This wipes existing users so register flow starts fresh.)

**Checkpoint**: DB has new schema. All data tables empty. Ready for register flow.

---

## Task 5: BE — Register endpoint + JWT with familyId

**Files:**
- Create: `apps/api/src/shared/auth/dto/register.dto.ts`
- Modify: `apps/api/src/modules/users/users.service.ts`
- Modify: `apps/api/src/shared/auth/auth.service.ts`
- Modify: `apps/api/src/shared/auth/auth.controller.ts`
- Modify: `apps/api/src/shared/auth/strategies/jwt.strategy.ts`

- [ ] **Step 1: Create RegisterDto**

```ts
import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsIn(['male', 'female'])
  gender!: 'male' | 'female';

  @IsOptional()
  @IsISO8601()
  birthdate?: string;
}
```

(`weddingDate` is NOT stored on user — passed as URL state in FE only, used to prefill `/family/setup` form.)

- [ ] **Step 2: Add `createForRegister` to UsersService**

In `apps/api/src/modules/users/users.service.ts`:

```ts
async createForRegister(dto: RegisterDto): Promise<User> {
  const existing = await this.userRepo.findOneBy({ email: dto.email });
  if (existing) throw new ConflictException('Email đã được đăng ký.');
  const passwordHash = await bcrypt.hash(dto.password, 10);
  const user = this.userRepo.create({
    email: dto.email,
    name: dto.name,
    gender: dto.gender,
    birthdate: dto.birthdate ?? null,
    passwordHash,
    familyId: null,
    role: null,
  });
  return this.userRepo.save(user);
}
```

Imports: `import { ConflictException } from '@nestjs/common'; import * as bcrypt from 'bcrypt';`

- [ ] **Step 3: Add register to AuthService**

In `apps/api/src/shared/auth/auth.service.ts`, add method:

```ts
async register(dto: RegisterDto): Promise<{ accessToken: string; user: AuthUserView }> {
  const user = await this.usersService.createForRegister(dto);
  return this.issueToken(user);
}

private issueToken(user: User): { accessToken: string; user: AuthUserView } {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    familyId: user.familyId,
  };
  const accessToken = this.jwtService.sign(payload);
  return { accessToken, user: this.toView(user) };
}

private toView(user: User): AuthUserView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    gender: user.gender,
    familyId: user.familyId,
    birthdate: user.birthdate,
  };
}
```

Define `AuthUserView` type at top of file or in `auth.types.ts`:
```ts
export interface AuthUserView {
  id: string;
  email: string;
  name: string;
  role: 'husband' | 'wife' | null;
  gender: 'male' | 'female';
  familyId: string | null;
  birthdate: string | null;
}
```

Update existing `login` method to also return via `issueToken` (consistent shape).

- [ ] **Step 4: Add controller endpoint**

In `apps/api/src/shared/auth/auth.controller.ts`:

```ts
@Post('register')
register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}
```

- [ ] **Step 5: Update JWT strategy to extract familyId**

In `apps/api/src/shared/auth/strategies/jwt.strategy.ts`, the validate method:

```ts
async validate(payload: { sub: string; email: string; role: string | null; familyId: string | null }) {
  const user = await this.usersService.findById(payload.sub);
  if (!user) throw new UnauthorizedException();
  return user; // user.familyId is already on the entity
}
```

Make sure `user` returned to req.user has `.familyId` — since we're returning the entity, this is already true.

- [ ] **Step 6: Update `/auth/me` to return AuthUserView**

In `auth.controller.ts`:

```ts
@UseGuards(JwtAuthGuard)
@Get('me')
me(@CurrentUser() user: User) {
  return this.authService.toView(user); // expose toView as public if needed
}
```

(Or move toView to a util.)

**Checkpoint**: `POST /api/auth/register` works. JWT contains familyId. `GET /api/auth/me` returns user with familyId.

---

## Task 6: FamilyRequiredGuard

**Files:**
- Create: `apps/api/src/shared/auth/guards/family-required.guard.ts`

- [ ] **Step 1: Write guard**

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { User } from '../../../modules/users/entities/user.entity';

@Injectable()
export class FamilyRequiredGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: User }>();
    if (!req.user?.familyId) {
      throw new ForbiddenException('Bạn chưa thuộc gia đình nào.');
    }
    return true;
  }
}
```

- [ ] **Step 2: Apply to existing controllers**

In each existing controller that has `@UseGuards(JwtAuthGuard)`, add `FamilyRequiredGuard` after JWT:

```ts
@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/funds')
export class FundsController { /* ... */ }
```

Apply to: `funds.controller.ts`, `transactions.controller.ts`, `goals.controller.ts`, `categories.controller.ts`, `important-dates.controller.ts`, `chat.controller.ts`, `reports.controller.ts`, `salary-rules.controller.ts`.

**DO NOT** apply to: `auth.controller.ts`, `users.controller.ts` (if separate `/me`), or upcoming `families.controller.ts` (it manages family lifecycle).

**Checkpoint**: All data routes return 403 if user.familyId is null.

---

## Task 7: Families service + completion logic

**Files:**
- Create: `apps/api/src/modules/families/families.service.ts`
- Create: `apps/api/src/modules/families/dto/create-family.dto.ts`
- Create: `apps/api/src/modules/families/dto/create-invitation.dto.ts`

- [ ] **Step 1: DTOs**

`create-family.dto.ts`:
```ts
import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CreateFamilyDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsISO8601()
  weddingDate?: string;
}
```

`create-invitation.dto.ts`:
```ts
import { IsEmail } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;
}
```

- [ ] **Step 2: Service skeleton**

```ts
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Family } from './entities/family.entity';
import { FamilyInvitation } from './entities/family-invitation.entity';
import { User } from '../users/entities/user.entity';
import { Fund } from '../funds/entities/fund.entity';
import { Category } from '../categories/entities/category.entity';
import { ImportantDate } from '../important-dates/entities/important-date.entity';
import { DEFAULT_CATEGORIES } from './default-categories';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const INVITATION_TTL_DAYS = 7;
const MAX_FAMILY_SIZE = 2;

@Injectable()
export class FamiliesService {
  constructor(
    @InjectRepository(Family) private readonly familyRepo: Repository<Family>,
    @InjectRepository(FamilyInvitation)
    private readonly invitationRepo: Repository<FamilyInvitation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Fund) private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(ImportantDate)
    private readonly importantDateRepo: Repository<ImportantDate>,
  ) {}

  async createForUser(user: User, dto: CreateFamilyDto): Promise<Family> {
    if (user.familyId)
      throw new ConflictException('Bạn đã ở trong một gia đình.');
    const family = await this.familyRepo.save(
      this.familyRepo.create({
        name: dto.name,
        weddingDate: dto.weddingDate ?? null,
        createdById: user.id,
      }),
    );
    user.familyId = family.id;
    user.role = user.gender === 'male' ? 'husband' : 'wife';
    await this.userRepo.save(user);
    return family;
  }

  async getCurrent(user: User): Promise<{ family: Family; members: User[] }> {
    if (!user.familyId)
      throw new NotFoundException('Bạn chưa ở trong gia đình nào.');
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId });
    const members = await this.userRepo.findBy({ familyId: family.id });
    return { family, members };
  }

  async createInvitation(
    user: User,
    dto: CreateInvitationDto,
  ): Promise<FamilyInvitation & { link: string }> {
    if (!user.familyId)
      throw new ForbiddenException('Bạn cần ở trong gia đình.');
    const members = await this.userRepo.findBy({ familyId: user.familyId });
    if (members.length >= MAX_FAMILY_SIZE)
      throw new BadRequestException('Gia đình đã đủ thành viên.');

    // Delete prior pending invitations for this family
    await this.invitationRepo
      .createQueryBuilder()
      .delete()
      .where({ familyId: user.familyId, acceptedAt: null })
      .execute();

    const token = randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const invitation = await this.invitationRepo.save(
      this.invitationRepo.create({
        familyId: user.familyId,
        createdById: user.id,
        email: dto.email,
        token,
        expiresAt,
      }),
    );

    const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/invite/${token}`;
    console.log(`[FamilyInvitation] Send to ${dto.email}: ${link}`);
    // TODO: actually call EmailService.send when SendGrid DMARC fixed.

    return { ...invitation, link };
  }

  async getInvitationByToken(token: string): Promise<{
    invitation: FamilyInvitation;
    family: Family;
    inviter: { name: string };
  }> {
    const invitation = await this.invitationRepo.findOneBy({ token });
    if (!invitation) throw new NotFoundException('Link mời không hợp lệ.');
    if (invitation.acceptedAt)
      throw new BadRequestException('Link đã được dùng.');
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('Link đã hết hạn.');
    const family = await this.familyRepo.findOneByOrFail({
      id: invitation.familyId,
    });
    const inviter = await this.userRepo.findOneByOrFail({
      id: invitation.createdById,
    });
    return { invitation, family, inviter: { name: inviter.name } };
  }

  async acceptInvitation(user: User, token: string): Promise<Family> {
    const invitation = await this.invitationRepo.findOneBy({ token });
    if (!invitation) throw new NotFoundException('Link mời không hợp lệ.');
    if (invitation.acceptedAt)
      throw new BadRequestException('Link đã được dùng.');
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('Link đã hết hạn.');
    if (user.familyId)
      throw new ConflictException('Bạn đã ở trong một gia đình.');

    const members = await this.userRepo.findBy({ familyId: invitation.familyId });
    if (members.length >= MAX_FAMILY_SIZE)
      throw new BadRequestException('Gia đình đã đủ thành viên.');

    user.familyId = invitation.familyId;
    // Assign role: opposite of existing member if any
    const existingRoles = members.map((m) => m.role);
    if (existingRoles.includes('husband')) {
      user.role = 'wife';
    } else if (existingRoles.includes('wife')) {
      user.role = 'husband';
    } else {
      user.role = user.gender === 'male' ? 'husband' : 'wife';
    }
    await this.userRepo.save(user);

    invitation.acceptedAt = new Date();
    invitation.acceptedById = user.id;
    await this.invitationRepo.save(invitation);

    await this.completeIfReady(invitation.familyId);

    return this.familyRepo.findOneByOrFail({ id: invitation.familyId });
  }

  async completeIfReady(familyId: string): Promise<void> {
    const family = await this.familyRepo.findOneByOrFail({ id: familyId });
    if (family.completedAt) return;
    const members = await this.userRepo.findBy({ familyId });
    if (members.length < 2) return;

    const husband = members.find((m) => m.role === 'husband') ?? members[0];
    const wife = members.find((m) => m.role === 'wife') ?? members[1];

    // 1. Funds
    await this.fundRepo.save([
      this.fundRepo.create({
        familyId,
        name: `Quỹ ${husband.name}`,
        type: 'personal',
        purpose: 'spending',
        ownerId: husband.id,
        balance: 0,
      }),
      this.fundRepo.create({
        familyId,
        name: `Quỹ ${wife.name}`,
        type: 'personal',
        purpose: 'spending',
        ownerId: wife.id,
        balance: 0,
      }),
      this.fundRepo.create({
        familyId,
        name: 'Quỹ Chung',
        type: 'joint',
        purpose: 'spending',
        ownerId: null,
        balance: 0,
      }),
    ]);

    // 2. Categories
    for (const seed of DEFAULT_CATEGORIES) {
      const parent = await this.categoryRepo.save(
        this.categoryRepo.create({
          familyId,
          name: seed.name,
          icon: seed.icon,
          isEssential: seed.isEssential,
          parentId: null,
        }),
      );
      for (const child of seed.children ?? []) {
        await this.categoryRepo.save(
          this.categoryRepo.create({
            familyId,
            name: child,
            isEssential: seed.isEssential,
            parentId: parent.id,
          }),
        );
      }
    }

    // 3. Important dates
    const importantDates: Partial<ImportantDate>[] = [];
    if (husband.birthdate) {
      importantDates.push({
        familyId,
        name: `Sinh nhật ${husband.name}`,
        type: 'birthday',
        date: husband.birthdate,
        isLunar: false,
        remindDaysBefore: [0, 7],
        notes: null,
        createdById: husband.id,
      });
    }
    if (wife.birthdate) {
      importantDates.push({
        familyId,
        name: `Sinh nhật ${wife.name}`,
        type: 'birthday',
        date: wife.birthdate,
        isLunar: false,
        remindDaysBefore: [0, 7],
        notes: null,
        createdById: wife.id,
      });
    }
    if (family.weddingDate) {
      importantDates.push({
        familyId,
        name: 'Kỷ niệm cưới',
        type: 'anniversary',
        date: family.weddingDate,
        isLunar: false,
        remindDaysBefore: [0, 7],
        notes: null,
        createdById: family.createdById,
      });
    }
    if (importantDates.length > 0) {
      await this.importantDateRepo.save(importantDates);
    }

    family.completedAt = new Date();
    await this.familyRepo.save(family);
  }
}
```

- [ ] **Step 3: Default categories file**

Create `apps/api/src/modules/families/default-categories.ts`. Copy `DEFAULT_CATEGORIES` from existing `seed.ts` (the const that has 11 categories like Ăn ngoài, Cà phê, Đi lại, etc.). Reference shape:

```ts
export const DEFAULT_CATEGORIES: {
  name: string;
  icon: string;
  isEssential: boolean;
  children?: string[];
}[] = [
  // copy from seed.ts
];
```

Read existing seed.ts to find this constant.

**Checkpoint**: FamiliesService methods compile. Completion logic creates 3 funds + categories + important dates idempotently.

---

## Task 8: Families controller + module

**Files:**
- Create: `apps/api/src/modules/families/families.controller.ts`
- Create: `apps/api/src/modules/families/families.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Controller**

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Controller('api/families')
export class FamiliesController {
  constructor(private readonly service: FamiliesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateFamilyDto) {
    return this.service.createForUser(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrent(@CurrentUser() user: User) {
    return this.service.getCurrent(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/invitations')
  createInvitation(
    @CurrentUser() user: User,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.service.createInvitation(user, dto);
  }

  // Public — preview before login
  @Get('invitations/:token')
  getInvitation(@Param('token') token: string) {
    return this.service.getInvitationByToken(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:token/accept')
  acceptInvitation(@CurrentUser() user: User, @Param('token') token: string) {
    return this.service.acceptInvitation(user, token);
  }
}
```

- [ ] **Step 2: Module**

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family } from './entities/family.entity';
import { FamilyInvitation } from './entities/family-invitation.entity';
import { User } from '../users/entities/user.entity';
import { Fund } from '../funds/entities/fund.entity';
import { Category } from '../categories/entities/category.entity';
import { ImportantDate } from '../important-dates/entities/important-date.entity';
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Family,
      FamilyInvitation,
      User,
      Fund,
      Category,
      ImportantDate,
    ]),
  ],
  providers: [FamiliesService],
  controllers: [FamiliesController],
  exports: [FamiliesService],
})
export class FamiliesModule {}
```

- [ ] **Step 3: Register in app.module**

Add `FamiliesModule` to `imports` array in `apps/api/src/app.module.ts`.

After acceptance, the BE should re-issue JWT — but FE will explicitly call `POST /auth/refresh` or just login again. Simpler: have `acceptInvitation` controller method also return a new JWT. Update controller:

```ts
@UseGuards(JwtAuthGuard)
@Post('invitations/:token/accept')
async acceptInvitation(
  @CurrentUser() user: User,
  @Param('token') token: string,
) {
  const family = await this.service.acceptInvitation(user, token);
  // user object was mutated; load fresh and re-issue token
  const fresh = await this.usersService.findById(user.id);
  return this.authService.issueTokenForUser(fresh!);
}
```

Same pattern for `POST /api/families`. Inject `AuthService` + `UsersService` in FamiliesController. Make `issueToken` public (rename to `issueTokenForUser`).

**Checkpoint**: All family endpoints work. Create-family + accept-invitation return new JWT.

---

## Task 9: Refactor existing services to scope by familyId — Funds + Transactions + Reports

**Files:**
- Modify: `apps/api/src/modules/funds/funds.service.ts`
- Modify: `apps/api/src/modules/transactions/transactions.service.ts`
- Modify: `apps/api/src/modules/reports/reports.service.ts`

This is the biggest refactor. Replace `visibleFundIds(user)` pattern with familyId scoping.

- [ ] **Step 1: Funds service**

Rewrite `listForUser` (or whatever current method) to scope by familyId, then apply privacy filter:

```ts
async listForUser(user: User): Promise<FundView[]> {
  const all = await this.fundRepo.find({
    where: { familyId: user.familyId! },
    order: { type: 'ASC', name: 'ASC' },
  });
  // Privacy: personal funds visible only to owner; joint funds visible to all family members
  return all
    .filter((f) => f.type === 'joint' || f.ownerId === user.id)
    .map(toFundView);
}
```

Replace any `findOneBy({ name })` with `findOneBy({ name, familyId: user.familyId! })` — fund names only unique within family.

- [ ] **Step 2: Transactions service**

Replace `visibleFundIds(user)` helper (delete the method) with:

```ts
private async visibleFundIdsForUser(user: User): Promise<string[]> {
  const funds = await this.fundRepo.find({
    where: { familyId: user.familyId! },
  });
  return funds
    .filter((f) => f.type === 'joint' || f.ownerId === user.id)
    .map((f) => f.id);
}
```

Add `familyId: user.familyId` to inserts in `createFromAgent`. The transaction's familyId comes from the user, denormalized for fast queries.

- [ ] **Step 3: Reports service**

Update queries to filter by `transaction.family_id = :familyId` (denormalized column). Where there's `WHERE fund_id IN (visible)`, prefer `WHERE family_id = :familyId AND fund_id IN (visible)` for index hit.

- [ ] **Step 4: Build check**

```bash
pnpm --filter api build
```

Expected: pass. Fix any TS errors from missing familyId.

**Checkpoint**: Funds + Transactions + Reports scoped by family. Existing privacy 3-fund pattern still applies within family.

---

## Task 10: Refactor remaining services — Goals, Categories, ImportantDates, Chat, YearlyAi, SalaryRules

**Files:**
- Modify: `apps/api/src/modules/goals/goals.service.ts`
- Modify: `apps/api/src/modules/categories/categories.service.ts`
- Modify: `apps/api/src/modules/important-dates/important-dates.service.ts`
- Modify: `apps/api/src/modules/important-dates/yearly-ai.service.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/salary-rules/salary-rules.service.ts`
- Modify: `apps/api/src/agent/subagents/parser/parser.subagent.ts` — context query

For each service:
- Every query that fetches data adds `where: { familyId: user.familyId! }`
- Every insert sets `familyId: user.familyId!`
- Every controller method takes `@CurrentUser() user: User` if not already

Specific notes:

- [ ] **Step 1: Categories**

Categories are now per-family. `categoriesService.list()` becomes `list(user)` with `where familyId`. Parser context (in `parser.subagent.ts`) which queries categories must pass user/familyId. Update `buildContext` to scope categories by `user.familyId`.

- [ ] **Step 2: ImportantDates + YearlyAi**

`important-dates.service.list()` → `list(user)` with familyId. Same for `findOne(id, user)` — verify `family_id` matches.

`YearlyAiService.findCache(year)` → `findCache(year, familyId)`. Same for `regenerate(year, familyId)` and `ensureCache(year, familyId)`. Update callers in cron + service.

Cron `onModuleInit` and `yearlyAiTick`: previously assumed single global cache. Now needs to iterate ALL families:

```ts
onModuleInit(): void {
  void this.warmAllFamilies().catch(...);
}

private async warmAllFamilies(): Promise<void> {
  const families = await this.familyRepo.find({ where: { completedAt: Not(IsNull()) } });
  const year = todayInTimezone(TZ).getUTCFullYear();
  for (const f of families) {
    await this.yearlyAi.ensureCache(year, f.id).catch((e) => this.logger.warn(...));
  }
}
```

- [ ] **Step 3: Chat**

`chat-sessions.service.list(user)` → `where familyId`. Insert sets familyId. Sessions visible to all family members (joint chat) — actually per spec, current chat is per-fund and sees same fund-privacy rules. Verify: when listing sessions, filter by `session.fund_id IN visibleFundIds`.

- [ ] **Step 4: Parser context query**

`parser.subagent.ts:buildContext` queries:
- `writableFunds = fundRepo.find({ where: [{ ownerId: user.id }, { ownerId: IsNull() }] })`
- categories
- existing important dates

Add `familyId: user.familyId!` to all of these. The user is already passed to `parse(message, user, options)`.

- [ ] **Step 5: Salary rules**

Add `familyId` scope.

- [ ] **Step 6: Build + lint**

```bash
pnpm --filter api lint
pnpm --filter api build
```

Both must pass.

**Checkpoint**: All BE services scoped by familyId. Build is clean.

---

## Task 11: Clean up seed.ts

**Files:**
- Modify: `apps/api/src/seed.ts`

- [ ] **Step 1: Remove user/fund/category seed**

Old seed creates 2 users + 3 funds + categories. New flow creates these via register + family completion. Delete user/fund seed code.

Keep seed.ts as a placeholder script that just logs "Seed not needed — use register flow":

```ts
import { DataSource } from 'typeorm';
import { dataSource } from './data-source';

async function seed(ds: DataSource): Promise<void> {
  console.log('Seed: no-op. Use POST /api/auth/register + family setup flow.');
}

async function main(): Promise<void> {
  await dataSource.initialize();
  await seed(dataSource);
  await dataSource.destroy();
}

main().catch(console.error);
```

The `DEFAULT_CATEGORIES` constant moves to `apps/api/src/modules/families/default-categories.ts` (already created in Task 7).

- [ ] **Step 2: Remove old `reset-transactions` script if it references old user constants**

If `apps/api/src/scripts/reset-transactions.ts` exists and references `HUSBAND_EMAIL` / `WIFE_EMAIL`, update to be family-scoped or delete.

**Checkpoint**: Seed is no-op. App relies on register flow.

---

## Task 12: FE — Auth types + register API

**Files:**
- Modify: `apps/web/features/auth/types.ts`
- Modify: `apps/web/features/auth/api.ts`

- [ ] **Step 1: Update AuthUser type**

```ts
export type UserRole = 'husband' | 'wife';
export type UserGender = 'male' | 'female';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  gender: UserGender;
  familyId: string | null;
  birthdate: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  gender: UserGender;
  birthdate?: string;
}
```

- [ ] **Step 2: Register API function**

In `apps/web/features/auth/api.ts`, add:

```ts
export function register(payload: RegisterPayload): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login'.replace('login', 'register'), {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}
```

Or simply:
```ts
export function register(payload: RegisterPayload): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}
```

**Checkpoint**: Types updated. Register API callable from FE.

---

## Task 13: FE — Register page

**Files:**
- Create: `apps/web/app/register/page.tsx`

- [ ] **Step 1: Page implementation**

Pattern from existing `app/login/page.tsx`. Form fields:
- Email (type=email, required)
- Password (min 8)
- Confirm password (must match)
- Name (text, required)
- Gender (radio: male/female, required)
- Birthdate (date, optional)
- Wedding date (date, optional — passed as URL state, not server)

On submit:
1. Call `register({ email, password, name, gender, birthdate })`
2. `setToken(accessToken)`
3. Build URL: `/family/setup?wedding=<weddingDate>` if user provided weddingDate
4. `router.replace(...)` to that URL

Drop demo / suggest section. Add link "Đã có tài khoản? Đăng nhập" → `/login`.

Code outline:
```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ApiError, setToken } from '@/lib/api-client';
import { register } from '@/features/auth/api';
import type { UserGender } from '@/features/auth/types';

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [birthdate, setBirthdate] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        gender,
        birthdate: birthdate || undefined,
      });
      setToken(res.accessToken);
      const redirect =
        next ?? (weddingDate
          ? `/family/setup?wedding=${weddingDate}`
          : '/family/setup');
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* card form similar to login/page.tsx, with all fields */
    <main>...</main>
  );
}
```

Use existing login styling for visual consistency.

**Checkpoint**: `/register` works. After register, lands at `/family/setup`.

---

## Task 14: FE — Login page (drop demo, add register link)

**Files:**
- Modify: `apps/web/app/login/page.tsx`

- [ ] **Step 1: Remove demo section**

Find the `// Dev hint` block with demo buttons (Demo Chồng / Demo Vợ). Delete entire block including parent div.

Also remove `fillDemo` function and its hardcoded credentials.

- [ ] **Step 2: Add "Chưa có tài khoản?" link**

Below the submit button, add:
```tsx
<p className="mt-4 text-center text-xs text-stone-500">
  Chưa có tài khoản?{' '}
  <Link href="/register" className="font-medium text-emerald-700 hover:underline">
    Đăng ký
  </Link>
</p>
```

- [ ] **Step 3: Handle `next` query param**

If URL has `?next=/invite/xxx`, after login redirect there instead of `/dashboard`.

```ts
const next = searchParams.get('next');
router.replace(next ?? '/dashboard');
```

**Checkpoint**: `/login` no demo. Has register link. Honors `next` param.

---

## Task 15: FE — Families API + types

**Files:**
- Create: `apps/web/features/families/types.ts`
- Create: `apps/web/features/families/api.ts`

- [ ] **Step 1: Types**

```ts
export interface FamilyView {
  id: string;
  name: string;
  weddingDate: string | null;
  createdById: string;
  completedAt: string | null;
}

export interface FamilyMembersView {
  family: FamilyView;
  members: {
    id: string;
    name: string;
    email: string;
    role: 'husband' | 'wife' | null;
  }[];
}

export interface InvitationPreview {
  invitation: { token: string; email: string; expiresAt: string };
  family: FamilyView;
  inviter: { name: string };
}

export interface CreateFamilyPayload {
  name: string;
  weddingDate?: string;
}

export interface CreateInvitationResponse {
  id: string;
  email: string;
  token: string;
  link: string;
  expiresAt: string;
}

import type { LoginResponse } from '../auth/types';

export type FamilyMutationResponse = LoginResponse; // BE re-issues JWT
```

- [ ] **Step 2: API**

```ts
import { apiFetch } from '@/lib/api-client';
import type {
  CreateFamilyPayload,
  CreateInvitationResponse,
  FamilyMembersView,
  FamilyMutationResponse,
  InvitationPreview,
} from './types';

export function createFamily(
  payload: CreateFamilyPayload,
): Promise<FamilyMutationResponse> {
  return apiFetch<FamilyMutationResponse>('/api/families', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMyFamily(): Promise<FamilyMembersView> {
  return apiFetch<FamilyMembersView>('/api/families/me');
}

export function createInvitation(
  email: string,
): Promise<CreateInvitationResponse> {
  return apiFetch<CreateInvitationResponse>('/api/families/me/invitations', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function getInvitation(token: string): Promise<InvitationPreview> {
  return apiFetch<InvitationPreview>(`/api/families/invitations/${token}`, {
    auth: false,
  });
}

export function acceptInvitation(
  token: string,
): Promise<FamilyMutationResponse> {
  return apiFetch<FamilyMutationResponse>(
    `/api/families/invitations/${token}/accept`,
    { method: 'POST' },
  );
}
```

**Checkpoint**: API + types compile.

---

## Task 16: FE — `/family/setup` page

**Files:**
- Create: `apps/web/app/(authed)/family/setup/page.tsx`

- [ ] **Step 1: Implementation**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { setToken } from '@/lib/api-client';
import { acceptInvitation, createFamily } from '@/features/families/api';
import { useAuth } from '@/features/auth/hooks';

export default function FamilySetupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const weddingPrefill = params.get('wedding') ?? '';

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [weddingDate, setWeddingDate] = useState(weddingPrefill);
  const [token, setTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'authed' && auth.user.familyId) {
    router.replace('/dashboard');
    return null;
  }

  async function onCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await createFamily({
        name: familyName.trim(),
        weddingDate: weddingDate || undefined,
      });
      setToken(res.accessToken);
      router.replace('/family/invite');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tạo gia đình');
    } finally {
      setSubmitting(false);
    }
  }

  async function onJoin() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await acceptInvitation(token.trim());
      setToken(res.accessToken);
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Token không hợp lệ');
    } finally {
      setSubmitting(false);
    }
  }

  // 3 UI states: choose | create | join — render accordingly
  // (full JSX with cards, form, back buttons)
  return <main>...</main>;
}
```

UI: 2 cards on `mode === 'choose'`:
- Card "Tạo gia đình mới" → click → `setMode('create')`
- Card "Tham gia bằng link" → click → `setMode('join')`

Form on each mode + back button.

**Checkpoint**: `/family/setup` lets user create or join.

---

## Task 17: FE — `/family/invite` page

**Files:**
- Create: `apps/web/app/(authed)/family/invite/page.tsx`

- [ ] **Step 1: Implementation**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInvitation, getMyFamily } from '@/features/families/api';
import type { FamilyMembersView, CreateInvitationResponse } from '@/features/families/types';

export default function FamilyInvitePage() {
  const router = useRouter();
  const [view, setView] = useState<FamilyMembersView | null>(null);
  const [email, setEmail] = useState('');
  const [invitation, setInvitation] = useState<CreateInvitationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    const v = await getMyFamily();
    setView(v);
    if (v.members.length === 2) router.replace('/dashboard');
  }

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 5000);
    return () => clearInterval(id);
  }, []);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const inv = await createInvitation(email.trim());
      setInvitation(inv);
    } finally {
      setSubmitting(false);
    }
  }

  return <main>...</main>;
}
```

UI:
- Show family name + member count "1/2 thành viên"
- Form: input email + submit "Gửi link mời"
- After invite created: show link with copy button + hint "Sao chép link gửi cho vợ/chồng (email service hiện chưa cấu hình)"
- Poll `/api/families/me` every 5s; redirect /dashboard when members.length === 2

**Checkpoint**: User can invite + see status. Auto-redirect when 2nd spouse joins.

---

## Task 18: FE — `/invite/[token]` public landing

**Files:**
- Create: `apps/web/app/invite/[token]/page.tsx`

- [ ] **Step 1: Implementation**

This page is OUTSIDE `(authed)` group — public. Logic:

1. On mount, GET invitation preview (`getInvitation(token)`) — works without auth
2. If user is not logged in (no token in localStorage): show "Bạn được mời tham gia `<family>` bởi `<inviter>`" + 2 buttons:
   - "Đăng nhập" → `/login?next=/invite/<token>`
   - "Đăng ký" → `/register?next=/invite/<token>`
3. If user IS logged in (has token + `useAuth()` returns authed):
   - If `user.familyId` is null: auto-call `acceptInvitation(token)` → save new token → redirect /dashboard
   - If `user.familyId` is not null: show error "Bạn đã ở trong một gia đình"

```tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setToken } from '@/lib/api-client';
import { acceptInvitation, getInvitation } from '@/features/families/api';
import { useAuth } from '@/features/auth/hooks';
import type { InvitationPreview } from '@/features/families/types';

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const auth = useAuth(false);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getInvitation(token).then(setPreview).catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (auth.status !== 'authed' || !preview) return;
    if (auth.user.familyId) {
      setError('Bạn đã ở trong một gia đình.');
      return;
    }
    void acceptInvitation(token)
      .then((r) => {
        setToken(r.accessToken);
        router.replace('/dashboard');
      })
      .catch((e) => setError(e.message));
  }, [auth, preview, token, router]);

  /* render preview or error or loading */
  return <main>...</main>;
}
```

Render: if `error` show error card. If `auth.status === 'unauthed'`, show 2 buttons (Login/Register, both with `?next=/invite/<token>`). If accepting, spinner.

**Checkpoint**: Landing page works for both new + existing users.

---

## Task 19: FE — Authed layout familyId guard

**Files:**
- Modify: `apps/web/app/(authed)/layout.tsx`

- [ ] **Step 1: Add familyId redirect**

Currently the layout checks `auth.status` and renders. Add: after auth resolved, if `user.familyId === null`, redirect to `/family/setup`.

Inside `AuthedLayout`:
```tsx
const isFamilySetupRoute = usePathname().startsWith('/family');

if (auth.status === 'authed' && !auth.user.familyId && !isFamilySetupRoute) {
  router.replace('/family/setup');
  return null;
}
```

(Routes under `/family/*` like `/family/setup` and `/family/invite` are still inside (authed) group but should be allowed without familyId — except invite which requires familyId. That gets enforced by GET /api/families/me returning 404 → redirect handled within page.)

Actually simpler: only `/family/setup` is allowed without familyId. Refine:
```tsx
if (auth.status === 'authed' && !auth.user.familyId && pathname !== '/family/setup') {
  router.replace('/family/setup');
}
```

- [ ] **Step 2: Sidebar — disable nav items if no family**

In `apps/web/components/layout/sidebar.tsx`, get `useAuthedLayout().user`. If `user.familyId` null, render disabled state for NAV items (or hide them). For simplicity: just rely on layout-level redirect. Sidebar renders normally; redirect happens before any NAV click loads content.

**Checkpoint**: Authed users without family forced to `/family/setup`. Family setup page does NOT redirect to itself (loop guard).

---

## Task 20: Final smoke test (manual)

**Files:** none

User performs end-to-end test:

- [ ] **Step 1: Restart api + web with clean DB**

```bash
psql $DATABASE_URL -c 'TRUNCATE TABLE "users", "families", "family_invitations" CASCADE;'
pnpm --filter api start:dev
pnpm --filter web dev
```

- [ ] **Step 2: User A registers**

1. Open http://localhost:3000/login → click "Đăng ký"
2. Fill form: email A, password, name "Anh", gender Male, birthdate, weddingDate
3. Submit → redirect /family/setup with `?wedding=...`
4. Click "Tạo gia đình mới" → fill name "Gia đình test" → submit
5. Redirect /family/invite. See member 1/2.

- [ ] **Step 3: Send invitation**

1. Type User B email → "Gửi link mời"
2. See link displayed + copied to console (BE log)
3. Copy the link `/invite/<token>`

- [ ] **Step 4: User B accepts**

1. Open invite link in incognito browser
2. See "Bạn được mời..."
3. Click Đăng ký → register form (next=/invite/...) → fill → submit
4. After register, redirect back to /invite/<token> → auto-accept → /dashboard

- [ ] **Step 5: Verify family complete**

1. /dashboard for User B: see 3 funds (Quỹ Anh, Quỹ <B>, Quỹ Chung)
2. /important-dates: see 2 sinh nhật + 1 kỷ niệm cưới
3. /transactions: empty list
4. Privacy: User A logs into another browser, only sees Quỹ Anh + Quỹ Chung (not Quỹ B)

- [ ] **Step 6: Privacy across families**

1. User C registers + creates new family "Family 2"
2. User C should NOT see any data from User A's family (no funds, no transactions)

- [ ] **Step 7: Run lint+build**

```bash
pnpm --filter api lint
pnpm --filter api build
pnpm --filter web lint
cd apps/web && npx tsc --noEmit
```

All must pass.

**Checkpoint**: All scenarios pass. Privacy + multi-tenancy verified.

---

## Acceptance criteria recap

1. New user can register with email/password/name/gender/(optional birthdate/weddingDate)
2. After register, forced to `/family/setup` (no access to /dashboard etc.)
3. Create family → JWT updated, redirect /family/invite
4. Send invitation → link displayed + console-logged
5. Open invite link → register/login → auto-accept → /dashboard
6. Family complete (2 spouse) → 3 funds + categories + important dates auto-created
7. All data scoped by family_id — User in Family 1 cannot see Family 2's data
8. Privacy 3-fund still works within family (User A doesn't see Quỹ User B)
9. `pnpm --filter api lint`, `pnpm --filter api build`, `pnpm --filter web lint`, `tsc --noEmit` all pass
