# Financial Month Cutoff Day — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép mỗi family cấu hình ngày bắt đầu "tháng tài chính" (mặc định 1 = calendar month, tối đa 28); mọi report/transactions filter/envelope progress dùng range tháng tài chính đó. UI hiển thị label "Tháng N" theo end-month + subtitle range.

**Architecture:** BE thêm 1 column `financial_month_cutoff_day` vào `families`, 1 shared helper `date-helpers.ts`, sửa `ReportsService.monthly/emptyDays` + `FundsService.listEnvelopes`. FE thêm helper `lib/financial-month.ts`, fetch family vào layout context, sửa MonthSwitcher (transactions + dashboard) để show subtitle range, thêm section settings.

**Tech Stack:** NestJS 11, TypeORM 0.3 migration, NextJS 16 App Router, next-intl, Tailwind v4. Jest cho BE unit test helpers.

**Spec:** [docs/superpowers/specs/2026-05-20-financial-month-cutoff-design.md](../specs/2026-05-20-financial-month-cutoff-design.md)

---

## File Structure

**Backend (`apps/api`):**
- Create: `src/shared/common/date-helpers.ts` — pure functions `getFinancialMonthRange`, `getCurrentFinancialMonth`.
- Create: `src/shared/common/date-helpers.spec.ts` — unit tests.
- Create: `migrations/<timestamp>-AddFinancialMonthCutoffDay.ts`.
- Modify: `src/modules/families/entities/family.entity.ts` — thêm column.
- Modify: `src/modules/families/dto/update-family.dto.ts` — thêm field.
- Modify: `src/modules/families/families.service.ts` — handle update field.
- Modify: `src/modules/reports/reports.service.ts` — dùng helper, inject FamiliesService.
- Modify: `src/modules/reports/reports.module.ts` — import FamiliesModule.
- Modify: `src/modules/funds/funds.service.ts` — dùng helper cho envelope.
- Modify: `src/modules/funds/funds.module.ts` — import FamiliesModule.

**Frontend (`apps/web`):**
- Create: `lib/financial-month.ts` — port helper từ BE.
- Modify: `features/families/types.ts` — `FamilyView` thêm `financialMonthCutoffDay`.
- Modify: `features/families/api.ts` — `updateFamily` payload type.
- Modify: `app/(authed)/layout.tsx` — fetch family, expose `cutoffDay` qua context.
- Modify: `app/(authed)/dashboard/page.tsx` — dùng `getCurrentFinancialMonth` + cutoffDay cho MonthSwitcher.
- Modify: `app/(authed)/transactions/page.tsx` — dùng helper cho start/end + cutoffDay cho MonthSwitcher.
- Modify: `features/transactions/components/month-switcher.tsx` — thêm subtitle range prop.
- Modify: `app/(authed)/finance-settings/page.tsx` — thêm section "Tháng tài chính".
- Modify: `messages/vi.json` + `messages/en.json` — keys mới.

---

### Task 1: BE — shared date helper + tests

**Files:**
- Create: `apps/api/src/shared/common/date-helpers.ts`
- Create: `apps/api/src/shared/common/date-helpers.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/shared/common/date-helpers.spec.ts`:

```ts
import {
  getFinancialMonthRange,
  getCurrentFinancialMonth,
} from './date-helpers';

describe('getFinancialMonthRange', () => {
  it('cutoff=1 returns calendar month range', () => {
    const { start, end } = getFinancialMonthRange(2026, 5, 1);
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('cutoff=25 returns 25/prev-month to 25/this-month', () => {
    const { start, end } = getFinancialMonthRange(2026, 5, 25);
    expect(start.toISOString()).toBe('2026-04-25T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-25T00:00:00.000Z');
  });

  it('cutoff=25 January wraps to previous December', () => {
    const { start, end } = getFinancialMonthRange(2026, 1, 25);
    expect(start.toISOString()).toBe('2025-12-25T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-25T00:00:00.000Z');
  });

  it('cutoff=28 February range works (no edge clamp needed)', () => {
    const { start, end } = getFinancialMonthRange(2026, 3, 28);
    expect(start.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-28T00:00:00.000Z');
  });
});

describe('getCurrentFinancialMonth', () => {
  it('cutoff=1 today=2026-05-15 → {2026, 5}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-05-15T08:00:00.000Z'), 1);
    expect(r).toEqual({ year: 2026, month: 5 });
  });

  it('cutoff=25 today=2026-05-24 (< cutoff) → {2026, 5}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-05-24T08:00:00.000Z'), 25);
    expect(r).toEqual({ year: 2026, month: 5 });
  });

  it('cutoff=25 today=2026-05-25 (>= cutoff) → {2026, 6}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-05-25T00:00:00.000Z'), 25);
    expect(r).toEqual({ year: 2026, month: 6 });
  });

  it('cutoff=25 today=2026-12-26 wraps year → {2027, 1}', () => {
    const r = getCurrentFinancialMonth(new Date('2026-12-26T00:00:00.000Z'), 25);
    expect(r).toEqual({ year: 2027, month: 1 });
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm --filter api test -- date-helpers`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `apps/api/src/shared/common/date-helpers.ts`:

```ts
export function getFinancialMonthRange(
  year: number,
  month: number,
  cutoffDay: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 2, cutoffDay));
  const end = new Date(Date.UTC(year, month - 1, cutoffDay));
  return { start, end };
}

export function getCurrentFinancialMonth(
  today: Date,
  cutoffDay: number,
): { year: number; month: number } {
  const d = today.getUTCDate();
  const m = today.getUTCMonth() + 1;
  const y = today.getUTCFullYear();
  if (d < cutoffDay) return { year: y, month: m };
  if (m === 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm --filter api test -- date-helpers`
Expected: all 8 cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/shared/common/date-helpers.ts apps/api/src/shared/common/date-helpers.spec.ts
git commit -m "feat(api): add financial-month date helpers"
```

---

### Task 2: BE — entity + migration

**Files:**
- Modify: `apps/api/src/modules/families/entities/family.entity.ts`
- Create: `apps/api/migrations/<timestamp>-AddFinancialMonthCutoffDay.ts`

- [ ] **Step 1: Add column to Family entity**

Edit `apps/api/src/modules/families/entities/family.entity.ts`. Replace entire file with:

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

  @Column({
    type: 'smallint',
    default: 1,
    name: 'financial_month_cutoff_day',
  })
  financialMonthCutoffDay!: number;
}
```

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter api migration:generate migrations/AddFinancialMonthCutoffDay`
Expected: file `apps/api/migrations/<timestamp>-AddFinancialMonthCutoffDay.ts` is created.

- [ ] **Step 3: Review and clean migration**

Open the generated file. It should have only:
- `ALTER TABLE "families" ADD "financial_month_cutoff_day" smallint NOT NULL DEFAULT 1`
- corresponding `down()` with `DROP COLUMN`.

If the generator includes unrelated changes (e.g., random column reorders), remove them — keep ONLY the two SQL statements above. If it generated nothing, stop and inspect — usually means entity didn't compile.

- [ ] **Step 4: Apply migration locally**

Run: `pnpm --filter api migration:run`
Expected: "Migrations executed".

Verify column exists:
```bash
docker compose exec -T postgres psql -U concord -d concord -c "\d families"
```
Expected: column `financial_month_cutoff_day | smallint | NOT NULL DEFAULT 1` appears.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/families/entities/family.entity.ts apps/api/migrations/
git commit -m "feat(api): add financial_month_cutoff_day to families"
```

---

### Task 3: BE — DTO + service field update

**Files:**
- Modify: `apps/api/src/modules/families/dto/update-family.dto.ts`
- Modify: `apps/api/src/modules/families/families.service.ts:102-113`

- [ ] **Step 1: Add field to UpdateFamilyDto**

Replace `apps/api/src/modules/families/dto/update-family.dto.ts` entire file:

```ts
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsISO8601()
  weddingDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  financialMonthCutoffDay?: number;
}
```

- [ ] **Step 2: Handle field in updateFamily service**

Edit `apps/api/src/modules/families/families.service.ts`. Find `updateFamily` (around line 102) and replace the function body so it handles the new field:

```ts
  async updateFamily(user: User, dto: UpdateFamilyDto): Promise<Family> {
    if (!user.familyId)
      throw new ForbiddenException('Bạn chưa ở trong gia đình nào.');
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId });
    if (dto.name !== undefined) family.name = dto.name;
    if (dto.weddingDate !== undefined) {
      family.weddingDate = dto.weddingDate
        ? dto.weddingDate.slice(0, 10)
        : null;
    }
    if (dto.financialMonthCutoffDay !== undefined) {
      family.financialMonthCutoffDay = dto.financialMonthCutoffDay;
    }
    return this.familyRepo.save(family);
  }
```

- [ ] **Step 3: Smoke test the endpoint**

Start api: `pnpm --filter api start:dev` (in background or separate terminal).

Run a smoke test (replace `<TOKEN>` with a valid JWT, or skip this step if no easy way — relying on integration in Task 5):
```bash
curl -X PATCH http://localhost:3001/api/families/me \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"financialMonthCutoffDay": 25}'
```
Expected: 200 with family object including `financialMonthCutoffDay: 25`.

If you cannot easily get a JWT, skip and trust the integration test path. Don't fail this task on the smoke test alone.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/families/dto/update-family.dto.ts apps/api/src/modules/families/families.service.ts
git commit -m "feat(api): accept financialMonthCutoffDay in PATCH /families/me"
```

---

### Task 4: BE — ReportsService uses cutoff

**Files:**
- Modify: `apps/api/src/modules/reports/reports.module.ts`
- Modify: `apps/api/src/modules/reports/reports.service.ts`

- [ ] **Step 1: Inject family repo + helper into module**

Open `apps/api/src/modules/reports/reports.module.ts`. The current `TypeOrmModule.forFeature([...])` likely lists `Transaction`, `Fund`. Add `Family`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fund } from '../funds/entities/fund.entity';
import { Family } from '../families/entities/family.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Fund, Family]),
    TransactionsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

(If the file already exists, preserve other imports / providers — just ensure `Family` is in the `forFeature` array. If `TransactionsModule` is currently imported differently, leave that part alone.)

- [ ] **Step 2: Inject Family repo into ReportsService**

Replace the constructor + `monthly` + `emptyDays` in `apps/api/src/modules/reports/reports.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Family } from '../families/entities/family.entity';
import { Fund } from '../funds/entities/fund.entity';
import { OPENING_BALANCE_NOTE } from '../funds/opening-balance.constants';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { User } from '../users/entities/user.entity';
import { getFinancialMonthRange } from '../../shared/common/date-helpers';

export type ReportScope = 'all' | 'joint';

export interface CategoryAggregate {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  amount: number;
  count: number;
}

export interface DayAggregate {
  date: string;
  income: number;
  expense: number;
}

export interface MonthlyReport {
  range: { start: string; end: string };
  income: number;
  expense: number;
  net: number;
  txnCount: number;
  byCategory: CategoryAggregate[];
  byDay: DayAggregate[];
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
    private readonly txnService: TransactionsService,
  ) {}

  async monthly(
    user: User,
    year: number,
    month: number,
    scope: ReportScope = 'all',
    fundId?: string,
  ): Promise<MonthlyReport> {
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId! });
    const cutoffDay = family.financialMonthCutoffDay;
    const { start, end } = getFinancialMonthRange(year, month, cutoffDay);

    let fundIds = await this.txnService.visibleFundIds(user);
    if (fundId && fundIds.includes(fundId)) {
      fundIds = [fundId];
    } else if (scope === 'joint' && fundIds.length > 0) {
      const jointFunds = await this.fundRepo.find({
        where: { id: In(fundIds), type: 'joint' },
        select: { id: true },
      });
      fundIds = jointFunds.map((f) => f.id);
    }
    if (fundIds.length === 0) {
      return {
        range: { start: start.toISOString(), end: end.toISOString() },
        income: 0,
        expense: 0,
        net: 0,
        txnCount: 0,
        byCategory: [],
        byDay: this.emptyDays(start, end),
      };
    }

    const allTxns = await this.txnRepo.find({
      where: {
        familyId: user.familyId!,
        fundId: In(fundIds),
        date: Between(start, new Date(end.getTime() - 1)),
      },
      relations: { category: true },
    });
    const txns = allTxns.filter((t) => t.note !== OPENING_BALANCE_NOTE);

    let income = 0;
    let expense = 0;
    const byCategoryMap = new Map<string, CategoryAggregate>();
    const byDayMap = new Map<string, DayAggregate>();

    for (const t of txns) {
      if (t.amount >= 0) income += t.amount;
      else expense += -t.amount;

      const catKey = t.category?.id ?? '__uncat__';
      const cat = byCategoryMap.get(catKey) ?? {
        categoryId: t.category?.id ?? null,
        categoryName: t.category?.name ?? 'Chưa phân loại',
        icon: t.category?.icon ?? null,
        amount: 0,
        count: 0,
      };
      if (t.amount < 0) cat.amount += -t.amount;
      cat.count += 1;
      byCategoryMap.set(catKey, cat);

      const dayKey = t.date.toISOString().slice(0, 10);
      const day = byDayMap.get(dayKey) ?? {
        date: dayKey,
        income: 0,
        expense: 0,
      };
      if (t.amount >= 0) day.income += t.amount;
      else day.expense += -t.amount;
      byDayMap.set(dayKey, day);
    }

    const filledDays = this.emptyDays(start, end).map(
      (d) => byDayMap.get(d.date) ?? d,
    );

    const byCategory = [...byCategoryMap.values()]
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      range: { start: start.toISOString(), end: end.toISOString() },
      income,
      expense,
      net: income - expense,
      txnCount: txns.length,
      byCategory,
      byDay: filledDays,
    };
  }

  private emptyDays(start: Date, end: Date): DayAggregate[] {
    const out: DayAggregate[] = [];
    const ONE_DAY = 24 * 60 * 60 * 1000;
    for (let t = start.getTime(); t < end.getTime(); t += ONE_DAY) {
      const iso = new Date(t).toISOString().slice(0, 10);
      out.push({ date: iso, income: 0, expense: 0 });
    }
    return out;
  }
}
```

Notes:
- `Between(start, new Date(end.getTime() - 1))` — TypeORM `Between` is inclusive on both ends; we want half-open `[start, end)`, so subtract 1ms from end.
- `emptyDays(start, end)` now iterates day-by-day in the financial range (could be cross-month).
- `family.findOneByOrFail` will throw if user has no familyId — existing layout already guarantees it; treat throw as "user has no family" 4xx surface to be debugged in QA but acceptable since current behavior also assumed familyId.

- [ ] **Step 3: Run tests + build**

Run: `pnpm --filter api test -- reports`
Expected: existing report tests still pass (if any). If no tests exist, OK.

Run: `pnpm --filter api build`
Expected: no TypeScript errors.

- [ ] **Step 4: Smoke test (optional)**

With api running and a user that has cutoff=1 (default), `GET /api/reports/monthly?year=2026&month=5` should behave identically to before. Set cutoff=25 via Task 3 endpoint and confirm range shifts.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reports/
git commit -m "feat(api): reports.monthly respects family financial month cutoff"
```

---

### Task 5: BE — FundsService envelope uses cutoff

**Files:**
- Modify: `apps/api/src/modules/funds/funds.module.ts`
- Modify: `apps/api/src/modules/funds/funds.service.ts:120-160`

- [ ] **Step 1: Add Family to FundsModule TypeOrm imports**

Open `apps/api/src/modules/funds/funds.module.ts`. Add `Family` to the `TypeOrmModule.forFeature([...])` array. Example (preserve existing entries — adjust to actual file):

```ts
import { Family } from '../families/entities/family.entity';
// ...
TypeOrmModule.forFeature([Fund, Transaction, Family /* ...existing */]),
```

If `Family` is already there (because Family entity is shared elsewhere), leave it.

- [ ] **Step 2: Inject FamilyRepo + use helper**

Edit `apps/api/src/modules/funds/funds.service.ts`. Around the existing constructor, add `@InjectRepository(Family) private readonly familyRepo: Repository<Family>`.

In `listEnvelopes` (around line 120–160), replace the block that hardcodes month start:

Before:
```ts
const monthStart = new Date();
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);
```

After:
```ts
const family = await this.familyRepo.findOneByOrFail({ id: user.familyId! });
const cutoffDay = family.financialMonthCutoffDay;
const today = new Date();
const { year: fy, month: fm } = getCurrentFinancialMonth(today, cutoffDay);
const { start: monthStart, end: monthEnd } = getFinancialMonthRange(fy, fm, cutoffDay);
```

Then update the SQL filter that currently does `t.date >= :start`:

Before:
```ts
.andWhere('t.date >= :start', { start: monthStart })
```

After:
```ts
.andWhere('t.date >= :start', { start: monthStart })
.andWhere('t.date < :end', { end: monthEnd })
```

Add imports at top of file (alongside existing imports):

```ts
import { Family } from '../families/entities/family.entity';
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
} from '../../shared/common/date-helpers';
```

- [ ] **Step 3: Build**

Run: `pnpm --filter api build`
Expected: no TypeScript errors.

- [ ] **Step 4: Smoke test (optional)**

Hit `GET /api/funds` for a user; envelope `monthContribution` should reflect financial month range.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/funds/
git commit -m "feat(api): envelope monthly contribution uses financial month cutoff"
```

---

### Task 6: FE — types + lib helper

**Files:**
- Create: `apps/web/lib/financial-month.ts`
- Modify: `apps/web/features/families/types.ts`

- [ ] **Step 1: Add field to FamilyView**

Edit `apps/web/features/families/types.ts`. Replace the `FamilyView` interface:

```ts
export interface FamilyView {
  id: string;
  name: string;
  weddingDate: string | null;
  createdById: string;
  completedAt: string | null;
  financialMonthCutoffDay: number;
}
```

(Other interfaces in the file unchanged.)

- [ ] **Step 2: Create lib helper**

Create `apps/web/lib/financial-month.ts`:

```ts
export function getFinancialMonthRange(
  year: number,
  month: number,
  cutoffDay: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 2, cutoffDay));
  const end = new Date(Date.UTC(year, month - 1, cutoffDay));
  return { start, end };
}

export function getCurrentFinancialMonth(
  today: Date,
  cutoffDay: number,
): { year: number; month: number } {
  const d = today.getUTCDate();
  const m = today.getUTCMonth() + 1;
  const y = today.getUTCFullYear();
  if (d < cutoffDay) return { year: y, month: m };
  if (m === 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}

export function formatFinancialMonthRange(
  start: Date,
  end: Date,
  locale: 'vi' | 'en',
): string {
  const endInclusive = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
      day: '2-digit',
      month: '2-digit',
    });
  return `${fmt(start)} — ${fmt(endInclusive)}`;
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter web build`
Expected: TypeScript compiles. Pre-existing `/family/invite` error remains — unrelated. Confirm no NEW type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/financial-month.ts apps/web/features/families/types.ts
git commit -m "feat(web): add financial-month helpers and FamilyView field"
```

---

### Task 7: FE — fetch family in layout, expose cutoffDay via context

**Files:**
- Modify: `apps/web/app/(authed)/layout.tsx`

- [ ] **Step 1: Extend LayoutCtx and fetch family**

Replace the relevant parts in `apps/web/app/(authed)/layout.tsx`. Specifically:

1. Add import for `getMyFamily`:
```tsx
import { getMyFamily } from '@/features/families/api';
import type { FamilyView } from '@/features/families/types';
```

2. Update `LayoutCtx` interface:
```tsx
interface LayoutCtx {
  user: AuthUser;
  funds: FundView[];
  family: FamilyView | null;
  reloadFunds: () => Promise<void>;
  reloadUser: () => Promise<void>;
}
```

3. Add state for family:
```tsx
const [family, setFamily] = useState<FamilyView | null>(null);
```

4. Add effect to fetch family when authenticated:
```tsx
useEffect(() => {
  if (auth.status === 'authed' && auth.user.familyId) {
    void getMyFamily()
      .then((res) => setFamily(res.family))
      .catch(() => {});
  }
}, [auth.status, auth]);
```

5. Update the two `<LayoutContext.Provider value={...}>` lines so each passes `family`:
```tsx
<LayoutContext.Provider value={{ user: auth.user, funds, family, reloadFunds, reloadUser }}>
```

(There are 2 `<LayoutContext.Provider>` blocks in the file — update both.)

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: no new TypeScript errors. Pages consuming `useAuthedLayout()` will compile even without using `family` (it's just added to context).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(authed\)/layout.tsx
git commit -m "feat(web): fetch family into authed layout context"
```

---

### Task 8: FE — update transactions MonthSwitcher with subtitle range

**Files:**
- Modify: `apps/web/features/transactions/components/month-switcher.tsx`
- Modify: `apps/web/messages/vi.json`, `apps/web/messages/en.json`

- [ ] **Step 1: Add new i18n keys**

Edit `apps/web/messages/vi.json`, in the `transactions` namespace, add:
```json
    "fiscal_range_aria": "Phạm vi tháng tài chính"
```

(Keep existing keys. Add as the last key inside `transactions` namespace.)

Edit `apps/web/messages/en.json`, same key:
```json
    "fiscal_range_aria": "Financial month range"
```

- [ ] **Step 2: Update component**

Replace `apps/web/features/transactions/components/month-switcher.tsx` entire file:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  formatFinancialMonthRange,
  getFinancialMonthRange,
} from '@/lib/financial-month';

export function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
  cutoffDay = 1,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
  cutoffDay?: number;
}) {
  const t = useTranslations('transactions');
  const locale = useLocale();
  const label = new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'vi-VN',
    { month: 'long', year: 'numeric' },
  );
  const showSubtitle = cutoffDay > 1;
  const subtitle = showSubtitle
    ? formatFinancialMonthRange(
        ...Object.values(getFinancialMonthRange(year, month, cutoffDay)) as [Date, Date],
        locale === 'en' ? 'en' : 'vi',
      )
    : null;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 sm:p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        aria-label={t('prev_month')}
      >
        <Chevron dir="left" />
      </button>
      <div className="min-w-[100px] px-2 py-1 text-center text-xs font-medium text-foreground sm:min-w-[120px] sm:px-3 sm:py-1 sm:text-sm">
        <div>{label}</div>
        {subtitle && (
          <div
            className="text-[10px] font-normal text-muted-foreground"
            aria-label={t('fiscal_range_aria')}
          >
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={t('next_month')}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}
```

Note: `cutoffDay` is optional with default 1 → component remains backward-compatible with any caller that doesn't pass it. Subtitle only renders when `cutoffDay > 1`.

The `Object.values(getFinancialMonthRange(...))` spread tuple feels clunky — replace with explicit:

Actually let's clean up. Replace the `subtitle` calculation to:
```tsx
  let subtitle: string | null = null;
  if (cutoffDay > 1) {
    const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
    subtitle = formatFinancialMonthRange(start, end, locale === 'en' ? 'en' : 'vi');
  }
```

(Use this cleaner form in the final code instead of the spread.)

- [ ] **Step 3: Build**

Run: `pnpm --filter web build`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/transactions/components/month-switcher.tsx apps/web/messages/vi.json apps/web/messages/en.json
git commit -m "feat(web): month switcher shows financial range subtitle when cutoff > 1"
```

---

### Task 9: FE — transactions page uses cutoff for range + switcher

**Files:**
- Modify: `apps/web/app/(authed)/transactions/page.tsx:79-105, 134-156`

- [ ] **Step 1: Update fetchData to use helper + pass cutoff to switcher**

In `apps/web/app/(authed)/transactions/page.tsx`:

1. Add import near top of file (alongside existing imports):
```tsx
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
} from '@/lib/financial-month';
```

2. Inside the component, after `const { funds, reloadFunds } = useAuthedLayout();` (or wherever the destructuring happens), update to also pull `family`:
```tsx
const { funds, reloadFunds, family } = useAuthedLayout();
const cutoffDay = family?.financialMonthCutoffDay ?? 1;
```

3. The initial `year`/`month` state should seed from current financial month. Find the existing `useState(now.getFullYear())` / `useState(now.getMonth() + 1)` (around lines 50-55) and replace:
```tsx
const now = new Date();
const initialFM = getCurrentFinancialMonth(now, cutoffDay);
const [year, setYear] = useState(initialFM.year);
const [month, setMonth] = useState(initialFM.month);
```

Wait — there's a subtle issue: `cutoffDay` depends on `family` which loads asynchronously. On first render `family` is null, `cutoffDay=1`, so initial year/month = calendar current month. When family loads with `cutoffDay=25`, we want to shift. Handle by adding an effect that resets year/month once family loads:

```tsx
useEffect(() => {
  if (!family) return;
  const { year: y, month: m } = getCurrentFinancialMonth(new Date(), family.financialMonthCutoffDay);
  setYear(y);
  setMonth(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [family?.id]);
```

Add this effect early in the component, after the existing state declarations.

4. Replace the existing `fetchData` body lines 81–82 (start/end calc):

Before:
```ts
const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
```

After:
```ts
const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
const apiEnd = new Date(end.getTime() - 1);
```

And update the `listTransactions` call to use `apiEnd.toISOString()` for the `to` field:
```ts
const res = await listTransactions({
  fundId: fundFilter || undefined,
  from: start.toISOString(),
  to: apiEnd.toISOString(),
  q: debouncedSearch.trim() || undefined,
  offset: page * PAGE_SIZE,
  limit: PAGE_SIZE,
});
```

5. Add `cutoffDay` to the `fetchData` dependency array (around line 101):
```ts
}, [year, month, fundFilter, debouncedSearch, page, cutoffDay]);
```

6. `isCurrentMonth` calc (around line 134): replace with financial-aware version:
```tsx
const currentFM = getCurrentFinancialMonth(now, cutoffDay);
const isCurrentMonth = year === currentFM.year && month === currentFM.month;
```

(`const now = new Date();` is already in the file at top; keep it.)

7. Pass `cutoffDay` to `<MonthSwitcher>`. Find the JSX block:
```tsx
<MonthSwitcher
  year={year}
  month={month}
  onShift={shiftMonth}
  isCurrent={isCurrentMonth}
/>
```

Replace with:
```tsx
<MonthSwitcher
  year={year}
  month={month}
  onShift={shiftMonth}
  isCurrent={isCurrentMonth}
  cutoffDay={cutoffDay}
/>
```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: no new TypeScript errors.

- [ ] **Step 3: Smoke test**

`pnpm --filter web dev` + `/transactions`:
- With cutoff=1 (default): page works exactly as before.
- After setting cutoff=25 (Task 12 settings UI) and reloading: MonthSwitcher shows "Tháng 5 / 25/04 — 24/05".

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(authed\)/transactions/page.tsx
git commit -m "feat(web): transactions page filters by financial month"
```

---

### Task 10: FE — dashboard MonthSwitcher uses cutoff

**Files:**
- Modify: `apps/web/app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Wire cutoffDay into dashboard**

Edit `apps/web/app/(authed)/dashboard/page.tsx`:

1. Add import:
```tsx
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
  formatFinancialMonthRange,
} from '@/lib/financial-month';
```

2. Pull family from layout: find `const { user, funds } = useAuthedLayout();` and change to:
```tsx
const { user, funds, family } = useAuthedLayout();
const cutoffDay = family?.financialMonthCutoffDay ?? 1;
```

3. The current init of `year/month`:
```tsx
const now0 = new Date();
const [year, setYear] = useState(now0.getFullYear());
const [month, setMonth] = useState(now0.getMonth() + 1);
```

Replace with:
```tsx
const now0 = new Date();
const initialFM = getCurrentFinancialMonth(now0, 1);
const [year, setYear] = useState(initialFM.year);
const [month, setMonth] = useState(initialFM.month);
```

(Using cutoffDay=1 initially; effect below will reset when family loads with a different cutoff.)

4. Add an effect right after state declarations to reset on family load:
```tsx
useEffect(() => {
  if (!family) return;
  const fm = getCurrentFinancialMonth(new Date(), family.financialMonthCutoffDay);
  setYear(fm.year);
  setMonth(fm.month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [family?.id]);
```

5. Pass `cutoffDay` to `<MonthStatsWidget>` props. Update the JSX:
```tsx
<MonthStatsWidget
  report={report}
  loading={loading || reportLoading}
  funds={spendingFunds}
  selectedFundId={reportFundId}
  onFundChange={setReportFundId}
  year={year}
  month={month}
  onShift={shiftMonth}
  cutoffDay={cutoffDay}
  t={t}
  tReports={tReports}
/>
```

6. Update `MonthStatsWidget` signature (the function definition further down the file). Add `cutoffDay: number` to the props type and parameters. Update the `isCurrentMonth` calc and pass `cutoffDay` to `<MonthSwitcher>`:

```tsx
function MonthStatsWidget({
  report,
  loading,
  funds,
  selectedFundId,
  onFundChange,
  year,
  month,
  onShift,
  cutoffDay,
  t,
  tReports,
}: {
  report: MonthlyReport | null;
  loading: boolean;
  funds: FundView[];
  selectedFundId: string;
  onFundChange: (id: string) => void;
  year: number;
  month: number;
  onShift: (delta: number) => void;
  cutoffDay: number;
  t: TFn;
  tReports: TFn;
}) {
  const currentFM = getCurrentFinancialMonth(new Date(), cutoffDay);
  const isCurrentMonth = year === currentFM.year && month === currentFM.month;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">📊 {t('month_title')}</h3>
        <MonthSwitcher
          year={year}
          month={month}
          onShift={onShift}
          isCurrent={isCurrentMonth}
          cutoffDay={cutoffDay}
          tReports={tReports}
        />
      </div>
      {/* ... rest of widget unchanged ... */}
    </div>
  );
}
```

(Keep the rest of the function body unchanged — only header div + `isCurrentMonth` source changed.)

7. Update local `MonthSwitcher` function in dashboard (defined at end of file) to accept `cutoffDay` and render subtitle:

```tsx
function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
  cutoffDay,
  tReports,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
  cutoffDay: number;
  tReports: TFn;
}) {
  const locale = useLocale();
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'vi-VN',
    { month: 'long', year: 'numeric' },
  );
  let subtitle: string | null = null;
  if (cutoffDay > 1) {
    const { start, end } = getFinancialMonthRange(year, month, cutoffDay);
    subtitle = formatFinancialMonthRange(start, end, locale === 'en' ? 'en' : 'vi');
  }
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        aria-label={tReports('previous_month')}
      >
        <ChevronIcon dir="left" />
      </button>
      <div className="min-w-[140px] px-3 py-1 text-center text-sm font-medium text-foreground">
        <div>{monthLabel}</div>
        {subtitle && (
          <div className="text-[10px] font-normal text-muted-foreground">{subtitle}</div>
        )}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={tReports('next_month')}
      >
        <ChevronIcon dir="right" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: no new type errors.

- [ ] **Step 3: Smoke test**

`pnpm --filter web dev` + `/dashboard`:
- cutoff=1: dashboard works as before, no subtitle.
- cutoff=25: month label = "Tháng 5", subtitle "25/04 — 24/05" appears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(authed\)/dashboard/page.tsx
git commit -m "feat(web): dashboard month switcher uses financial cutoff"
```

---

### Task 11: FE — settings UI section

**Files:**
- Modify: `apps/web/app/(authed)/finance-settings/page.tsx`
- Modify: `apps/web/features/families/api.ts`
- Modify: `apps/web/messages/vi.json`, `apps/web/messages/en.json`

- [ ] **Step 1: Add i18n keys**

Edit `apps/web/messages/vi.json`, in the `finance` namespace (around line 116), add at the end (before closing `}`):
```json
    "financial_month_title": "Tháng tài chính",
    "financial_month_desc": "Ngày bắt đầu của tháng tài chính. Mặc định 1 = tháng dương lịch. Đặt 25 nếu bạn nhận lương ngày 25 và muốn lương đó tính cho tháng kế tiếp.",
    "financial_month_label": "Ngày bắt đầu",
    "financial_month_hint": "Cutoff=25 nghĩa là \"Tháng 5\" tính từ 25/04 đến 24/05.",
    "financial_month_saved": "Đã lưu cutoff"
```

Edit `apps/web/messages/en.json`, same namespace, add:
```json
    "financial_month_title": "Financial month",
    "financial_month_desc": "Start day of the financial month. Default 1 = calendar month. Set 25 if you receive salary on day 25 and want it to count toward the next month.",
    "financial_month_label": "Start day",
    "financial_month_hint": "Cutoff=25 means \"Month 5\" spans 25/04 to 24/05.",
    "financial_month_saved": "Cutoff saved"
```

- [ ] **Step 2: Update updateFamily payload type**

Edit `apps/web/features/families/api.ts`. Update `updateFamily` payload type to accept the new field:

```ts
export function updateFamily(payload: {
  name?: string;
  weddingDate?: string | null;
  financialMonthCutoffDay?: number;
}): Promise<{
  id: string;
  name: string;
  weddingDate: string | null;
  createdById: string;
  completedAt: string | null;
  financialMonthCutoffDay: number;
}> {
  return apiFetch('/api/families/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Add section to settings page**

Edit `apps/web/app/(authed)/finance-settings/page.tsx`:

1. Add imports:
```tsx
import { updateFamily } from '@/features/families/api';
```

2. In the main `FinanceSettingsPage` JSX, add `<FinancialMonthSection />` BEFORE `<YearlyGoalSection />`:

```tsx
<div className="mx-auto max-w-3xl space-y-6">
  <FinancialMonthSection />
  <YearlyGoalSection />
  <OpeningBalanceSection />
</div>
```

3. Add the new section at the end of the file (after `OpeningBalanceRow`):

```tsx
function FinancialMonthSection() {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');
  const { family } = useAuthedLayout();
  const [value, setValue] = useState<number | ''>(family?.financialMonthCutoffDay ?? 1);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    if (family) setValue(family.financialMonthCutoffDay);
  }, [family?.financialMonthCutoffDay]);

  const isDirty =
    value !== '' &&
    Number(value) >= 1 &&
    Number(value) <= 28 &&
    Number(value) !== (family?.financialMonthCutoffDay ?? 1);

  async function onSave() {
    if (value === '' || Number(value) < 1 || Number(value) > 28) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateFamily({ financialMonthCutoffDay: Number(value) });
      setFeedback({ kind: 'ok', msg: t('financial_month_saved') });
      setTimeout(() => {
        setFeedback(null);
        window.location.reload();
      }, 1200);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Lỗi không xác định';
      setFeedback({ kind: 'err', msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-foreground">{t('financial_month_title')}</h3>
      <p className="mb-5 text-xs text-muted-foreground">{t('financial_month_desc')}</p>

      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('financial_month_label')}</label>
      <input
        type="number"
        min={1}
        max={28}
        value={value}
        onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 sm:w-32"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">{t('financial_month_hint')}</p>

      <div className="mt-5 flex flex-col items-start justify-between border-t border-border pt-4 sm:flex-row sm:items-center">
        {feedback && (
          <span className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {feedback.kind === 'ok' ? '✅' : '⚠️'} {feedback.msg}
          </span>
        )}
        <div className="mt-3 flex w-full gap-2 sm:ml-auto sm:mt-0 sm:w-auto sm:gap-3">
          <button
            onClick={() => { setValue(family?.financialMonthCutoffDay ?? 1); setFeedback(null); }}
            disabled={saving}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 sm:flex-none"
          >
            {tCommon('reset')}
          </button>
          <button
            onClick={onSave}
            disabled={saving || !isDirty}
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-muted sm:flex-none"
          >
            {saving ? tCommon('saving') : tCommon('save')}
          </button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Build + smoke test**

Run: `pnpm --filter web build`
Expected: no new type errors.

Smoke test (`pnpm --filter web dev`):
- Open `/finance-settings` → "Tháng tài chính" section appears at top.
- Set to 25 → Save → page reloads → MonthSwitcher on dashboard now shows subtitle "25/04 — 24/05".
- Reset to 1 → Save → subtitle disappears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(authed\)/finance-settings/page.tsx apps/web/features/families/api.ts apps/web/messages/vi.json apps/web/messages/en.json
git commit -m "feat(web): add financial month cutoff section to finance settings"
```

---

## Self-Review

**Spec coverage:**
- ✅ BE entity + migration → Task 2.
- ✅ Shared helpers BE + tests → Task 1.
- ✅ Shared helpers FE → Task 6.
- ✅ DTO + service updateFamily → Task 3.
- ✅ ReportsService uses cutoff → Task 4.
- ✅ FundsService envelope uses cutoff → Task 5.
- ✅ Family in FE layout context → Task 7.
- ✅ Transactions page filter + switcher → Task 9 + 8.
- ✅ Dashboard switcher → Task 10.
- ✅ Settings UI section → Task 11.
- ✅ i18n keys → Task 8, 11.
- ✅ Goals/important-dates NOT touched → confirmed (no tasks).
- ✅ Range 1–28 validated in DTO (`@Max(28)`) → Task 3.

**Placeholder scan:** No TBD / TODO / "similar to". Each step has full code.

**Type consistency:**
- `getFinancialMonthRange(year, month, cutoffDay)` — same signature BE (Task 1) + FE (Task 6).
- `getCurrentFinancialMonth(today, cutoffDay)` — same signature both sides.
- `FamilyView.financialMonthCutoffDay: number` — used in layout (Task 7), transactions page (Task 9), dashboard (Task 10), settings (Task 11) — all consistent.
- `MonthSwitcher` in transactions: `cutoffDay?: number` (optional, default 1) — backward compatible (Task 8).
- Dashboard local `MonthSwitcher`: `cutoffDay: number` required (Task 10) — only one caller, OK.
- `UpdateFamilyDto.financialMonthCutoffDay?: number` (Task 3) matches FE payload type (Task 11).

**Risk callouts (informational):**
- Task 7 fetches `getMyFamily()` after layout mounts → there is a brief window where pages render with `cutoffDay=1` then re-render. The `useEffect([family?.id])` in Tasks 9 and 10 handles the reset. If the user changes cutoff and reloads, the page will briefly show calendar then shift — acceptable.
- Existing transactions API accepts `from`/`to` ISO strings as inclusive bounds (per current usage in `apps/web/app/(authed)/transactions/page.tsx`). Task 9 passes `apiEnd = end - 1ms` to keep the half-open semantics intact at the API boundary. If the BE transactions list endpoint treats `to` as strictly inclusive (i.e., includes `t.date <= to`), this is correct. If it ever changes to exclusive, the `-1ms` becomes wrong — but that's out of scope here.

Plan complete.
