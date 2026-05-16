# Debts & Loans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user tạo/track khoản cho vay (lent) và đi vay (borrowed) qua chat hoặc UI `/debts`, với partial payments, tự cập nhật balance quỹ và tự đóng khi trả hết.

**Architecture:** Module `debts` riêng (entity `Debt` + `DebtPayment`), mọi cash flow đi qua `TransactionsService` để reuse balance update & privacy. Parser thêm 2 tool (`open_debt`, `record_debt_payment`). UI: page `/debts` với summary cards + tabs + dialogs.

**Tech Stack:** NestJS 11 + TypeORM 0.3 + PostgreSQL, Anthropic SDK (Haiku 4.5 parser), Next.js 16 App Router + Tailwind v4, Jest.

**Spec:** [`docs/superpowers/specs/2026-05-16-debts-feature-design.md`](../specs/2026-05-16-debts-feature-design.md)

---

## File Structure

### Backend (`apps/api`)

**Create:**
- `src/modules/debts/debts.module.ts`
- `src/modules/debts/debts.controller.ts`
- `src/modules/debts/debts.service.ts`
- `src/modules/debts/dto/create-debt.dto.ts`
- `src/modules/debts/dto/record-payment.dto.ts`
- `src/modules/debts/entities/debt.entity.ts`
- `src/modules/debts/entities/debt-payment.entity.ts`
- `src/modules/debts/debts.service.spec.ts`
- `migrations/<timestamp>-AddDebts.ts`

**Modify:**
- `src/app.module.ts` — register `DebtsModule`
- `src/data-source.ts` — register `Debt`, `DebtPayment` entities
- `src/modules/transactions/transactions.service.ts` — add `createInternal(...)`, expose `deleteForUserViaManager(...)` if needed
- `src/modules/transactions/transactions.module.ts` — already exports service (confirm)
- `src/agent/agent.module.ts` — import `DebtsModule`
- `src/agent/subagents/parser/parser.tools.ts` — add `open_debt`, `record_debt_payment` tools + input types
- `src/agent/subagents/parser/parser.subagent.ts` — inject `DebtsService` + `Debt` repo; add context block; 2 tool handlers; new ParseAction types; synthesizeReply updates
- `src/agent/subagents/parser/skill.md` — pattern recognition section
- `src/seed.ts` — seed 3 default categories: "Cho vay", "Đi vay", "Trả nợ"

### Frontend (`apps/web`)

**Create:**
- `app/(app)/debts/page.tsx`
- `features/debts/api.ts`
- `features/debts/types.ts`
- `features/debts/components/DebtsPageClient.tsx`
- `features/debts/components/DebtsSummaryCards.tsx`
- `features/debts/components/DebtsList.tsx`
- `features/debts/components/DebtCard.tsx`
- `features/debts/components/RecordPaymentDialog.tsx`
- `features/debts/components/CreateDebtDialog.tsx`
- `features/debts/components/DebtDetailDrawer.tsx`

**Modify:**
- `components/layout/Sidebar.tsx` (hoặc Nav tương đương) — link "Nợ & Cho vay"

---

## Task 1: Entity `Debt`

**Files:**
- Create: `apps/api/src/modules/debts/entities/debt.entity.ts`

- [ ] **Step 1: Create entity**

```ts
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { Fund } from '../../funds/entities/fund.entity';
import { User } from '../../users/entities/user.entity';
import { DebtPayment } from './debt-payment.entity';

export type DebtDirection = 'lent' | 'borrowed';
export type DebtStatus = 'open' | 'settled';

@Entity('debts')
@Index(['familyId'])
@Index(['fundId'])
@Index(['userId', 'status'])
export class Debt extends BaseEntity {
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', name: 'fund_id' })
  fundId!: string;

  @ManyToOne(() => Fund, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund;

  @Column({ type: 'enum', enum: ['lent', 'borrowed'] })
  direction!: DebtDirection;

  @Column({ type: 'text', name: 'counterparty_name' })
  counterpartyName!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  principal!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer, name: 'remaining_amount' })
  remainingAmount!: number;

  @Column({ type: 'enum', enum: ['open', 'settled'], default: 'open' })
  status!: DebtStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'timestamptz', name: 'opened_at' })
  openedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'closed_at' })
  closedAt!: Date | null;

  @OneToMany(() => DebtPayment, (p) => p.debt)
  payments!: DebtPayment[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/entities/debt.entity.ts
git commit -m "feat(api): add Debt entity"
```

---

## Task 2: Entity `DebtPayment`

**Files:**
- Create: `apps/api/src/modules/debts/entities/debt-payment.entity.ts`

- [ ] **Step 1: Create entity**

```ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../shared/common/transformers';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Debt } from './debt.entity';

export type DebtPaymentKind = 'open' | 'repayment';

@Entity('debt_payments')
@Index(['debtId'])
export class DebtPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'debt_id' })
  debtId!: string;

  @ManyToOne(() => Debt, (d) => d.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt!: Debt;

  @Column({ type: 'uuid', name: 'transaction_id', unique: true })
  transactionId!: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction;

  @Column({ type: 'enum', enum: ['open', 'repayment'] })
  kind!: DebtPaymentKind;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/entities/debt-payment.entity.ts
git commit -m "feat(api): add DebtPayment entity"
```

---

## Task 3: Register entities trong data-source

**Files:**
- Modify: `apps/api/src/data-source.ts`

- [ ] **Step 1: Read current entities array**

Run: `grep -n "entities:" apps/api/src/data-source.ts`

- [ ] **Step 2: Add imports + register**

Thêm imports `Debt`, `DebtPayment` từ `./modules/debts/entities/*` và push vào `entities: [...]` array (giữ alphabet order nếu có).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/data-source.ts
git commit -m "feat(api): register Debt entities in data-source"
```

---

## Task 4: Generate + apply migration

**Files:**
- Create: `apps/api/migrations/<timestamp>-AddDebts.ts`

- [ ] **Step 1: Generate migration**

Run: `pnpm --filter api migration:generate migrations/AddDebts`
Expected: file mới trong `apps/api/migrations/` chứa CREATE TABLE cho `debts` + `debt_payments`.

- [ ] **Step 2: Review migration SQL**

Mở file vừa generate. Verify:
- Bảng `debts` có đủ cột (family_id, user_id, fund_id, direction enum, counterparty_name, principal bigint, remaining_amount bigint, status enum default 'open', note, opened_at, closed_at nullable, id uuid PK, created_at, updated_at).
- Bảng `debt_payments` có FK với ON DELETE CASCADE, UNIQUE trên transaction_id.
- Indexes match entity decorator.

Sửa thủ công nếu generator thiếu enum names (TypeORM hay tạo enum tên xấu — đổi thành `debts_direction_enum`, `debts_status_enum`, `debt_payments_kind_enum`).

- [ ] **Step 3: Apply migration**

Run: `pnpm --filter api migration:run`
Expected: SUCCESS, log "Migration AddDebts<timestamp> has been executed successfully".

- [ ] **Step 4: Verify tables**

Run: `docker compose exec postgres psql -U postgres -d concord -c "\d debts" && docker compose exec postgres psql -U postgres -d concord -c "\d debt_payments"`
Expected: schema match spec.

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/*-AddDebts.ts
git commit -m "feat(api): migration for debts and debt_payments tables"
```

---

## Task 5: DTOs

**Files:**
- Create: `apps/api/src/modules/debts/dto/create-debt.dto.ts`
- Create: `apps/api/src/modules/debts/dto/record-payment.dto.ts`

- [ ] **Step 1: Write CreateDebtDto**

```ts
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDebtDto {
  @IsIn(['lent', 'borrowed'])
  direction!: 'lent' | 'borrowed';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  counterpartyName!: string;

  @IsInt()
  @Min(1)
  principal!: number;

  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsISO8601()
  openedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
```

- [ ] **Step 2: Write RecordPaymentDto**

```ts
import { IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/debts/dto/
git commit -m "feat(api): debts DTOs"
```

---

## Task 6: Add `createInternal` to TransactionsService

**Files:**
- Modify: `apps/api/src/modules/transactions/transactions.service.ts`

Method này để `DebtsService` gọi trực tiếp (không qua agent), nhận `fundId` + `categoryId` đã resolve, vẫn enforce privacy + update balance trong cùng DB transaction.

- [ ] **Step 1: Read current `createFromAgent`** để hiểu pattern cùng `resolveCategory`.

Run: `grep -n "createFromAgent\|resolveCategory\|deleteForUser" apps/api/src/modules/transactions/transactions.service.ts`

- [ ] **Step 2: Add `createInternal` method**

Thêm vào `TransactionsService`:

```ts
async createInternal(
  params: {
    fundId: string;
    userId: string;
    familyId: string;
    amount: number;
    categoryId: string | null;
    note: string | null;
    date: Date;
    source: 'chat' | 'form';
    rawText?: string | null;
  },
  user: User,
  manager?: import('typeorm').EntityManager,
): Promise<Transaction> {
  if (!Number.isFinite(params.amount) || params.amount === 0) {
    throw new BadRequestException(`Số tiền không hợp lệ: ${params.amount}.`);
  }

  const run = async (m: import('typeorm').EntityManager): Promise<Transaction> => {
    const fund = await m.findOneBy(Fund, { id: params.fundId });
    if (!fund || fund.familyId !== user.familyId) {
      throw new BadRequestException(`Fund không tồn tại.`);
    }
    if (fund.type === 'personal' && fund.ownerId !== user.id) {
      throw new ForbiddenException(`Không thể ghi vào quỹ riêng của người khác.`);
    }
    const created = m.create(Transaction, {
      familyId: params.familyId,
      userId: params.userId,
      fundId: fund.id,
      categoryId: params.categoryId,
      amount: params.amount,
      note: params.note,
      rawText: params.rawText ?? null,
      source: params.source,
      date: params.date,
    });
    const saved = await m.save(created);
    await m.increment(Fund, { id: fund.id }, 'balance', params.amount);
    return saved;
  };

  return manager ? run(manager) : this.dataSource.transaction(run);
}
```

- [ ] **Step 3: Add `deleteByIdInternal` helper**

Để rollback từ DebtsService. Thêm method:

```ts
async deleteByIdInternal(
  txnId: string,
  user: User,
  manager?: import('typeorm').EntityManager,
): Promise<void> {
  const run = async (m: import('typeorm').EntityManager): Promise<void> => {
    const txn = await m.findOne(Transaction, { where: { id: txnId }, relations: ['fund'] });
    if (!txn) throw new NotFoundException('Transaction không tồn tại.');
    if (txn.familyId !== user.familyId) throw new ForbiddenException();
    if (txn.fund.type === 'personal' && txn.fund.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    await m.decrement(Fund, { id: txn.fundId }, 'balance', txn.amount);
    await m.remove(txn);
  };
  return manager ? run(manager) : this.dataSource.transaction(run);
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter api build`
Expected: no TS errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/transactions/transactions.service.ts
git commit -m "feat(api): add createInternal + deleteByIdInternal for cross-module use"
```

---

## Task 7: Seed default categories

**Files:**
- Modify: `apps/api/src/seed.ts`

- [ ] **Step 1: Read seed.ts categories section**

Run: `grep -n "Cho vay\|Trả nợ\|categories\|DEFAULT_CATEGORIES" apps/api/src/seed.ts | head -20`

- [ ] **Step 2: Add 3 categories to default list**

Tìm array default categories (top-level) trong `seed.ts`. Thêm 3 entry mới (giữ format hiện tại):

```ts
{ name: 'Cho vay', icon: '🤝', isEssential: false },
{ name: 'Đi vay', icon: '🏦', isEssential: false },
{ name: 'Trả nợ', icon: '💸', isEssential: false },
```

Đảm bảo seed idempotent: phần check existing trước insert vẫn áp dụng (xem code pattern hiện tại).

- [ ] **Step 3: Run seed**

Run: `pnpm --filter api seed`
Expected: SUCCESS; nếu family đã có categories, log skip; nếu chưa thì insert 3 cái mới.

- [ ] **Step 4: Verify**

Run: `docker compose exec postgres psql -U postgres -d concord -c "SELECT name FROM categories WHERE name IN ('Cho vay', 'Đi vay', 'Trả nợ');"`
Expected: 3 rows (× số family nếu mỗi family clone categories — match pattern hiện tại).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/seed.ts
git commit -m "feat(api): seed Cho vay / Đi vay / Trả nợ categories"
```

---

## Task 8: `DebtsService` skeleton + module + controller

**Files:**
- Create: `apps/api/src/modules/debts/debts.service.ts`
- Create: `apps/api/src/modules/debts/debts.controller.ts`
- Create: `apps/api/src/modules/debts/debts.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write module skeleton**

`debts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Fund } from '../funds/entities/fund.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debt } from './entities/debt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debt, DebtPayment, Fund, Category]),
    TransactionsModule,
  ],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
```

- [ ] **Step 2: Write service skeleton (no impl yet)**

```ts
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Fund } from '../funds/entities/fund.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { User } from '../users/entities/user.entity';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debt } from './entities/debt.entity';

export interface DebtView {
  id: string;
  direction: 'lent' | 'borrowed';
  counterpartyName: string;
  principal: number;
  remainingAmount: number;
  paidAmount: number;
  status: 'open' | 'settled';
  fundId: string;
  fundName: string;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
}

export interface DebtPaymentView {
  id: string;
  kind: 'open' | 'repayment';
  amount: number;
  transactionId: string;
  paidAt: string;
  note: string | null;
}

export interface DebtSummary {
  totalLent: number;
  totalBorrowed: number;
  openLentCount: number;
  openBorrowedCount: number;
}

function toDebtView(d: Debt): DebtView {
  return {
    id: d.id,
    direction: d.direction,
    counterpartyName: d.counterpartyName,
    principal: d.principal,
    remainingAmount: d.remainingAmount,
    paidAmount: d.principal - d.remainingAmount,
    status: d.status,
    fundId: d.fundId,
    fundName: d.fund?.name ?? '',
    openedAt: d.openedAt.toISOString(),
    closedAt: d.closedAt ? d.closedAt.toISOString() : null,
    note: d.note,
  };
}

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name);

  constructor(
    @InjectRepository(Debt) private readonly debtRepo: Repository<Debt>,
    @InjectRepository(DebtPayment) private readonly paymentRepo: Repository<DebtPayment>,
    @InjectRepository(Fund) private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    private readonly transactionsService: TransactionsService,
    private readonly dataSource: DataSource,
  ) {}

  private async visibleFundIds(user: User): Promise<string[]> {
    const funds = await this.fundRepo.find({
      where: [
        { familyId: user.familyId!, ownerId: user.id },
        { familyId: user.familyId!, ownerId: IsNull() },
      ],
    });
    return funds.map((f) => f.id);
  }

  // method stubs — implemented in Task 9
  async listForUser(_user: User, _opts: { status?: 'open' | 'settled' | 'all'; direction?: 'lent' | 'borrowed' | 'all' }): Promise<DebtView[]> {
    throw new Error('not implemented');
  }
  async summaryForUser(_user: User): Promise<DebtSummary> {
    throw new Error('not implemented');
  }
  async findByIdForUser(_user: User, _id: string): Promise<{ debt: DebtView; payments: DebtPaymentView[] }> {
    throw new Error('not implemented');
  }
  async createDebt(_user: User, _input: CreateDebtDto, _source: 'chat' | 'form', _rawText?: string): Promise<DebtView> {
    throw new Error('not implemented');
  }
  async recordPayment(_user: User, _debtId: string, _input: RecordPaymentDto, _source: 'chat' | 'form'): Promise<{ debt: DebtView; payment: DebtPaymentView }> {
    throw new Error('not implemented');
  }
  async deletePayment(_user: User, _debtId: string, _paymentId: string): Promise<DebtView> {
    throw new Error('not implemented');
  }
  async deleteDebt(_user: User, _debtId: string): Promise<void> {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 3: Write controller skeleton**

```ts
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: 'open' | 'settled' | 'all',
    @Query('direction') direction?: 'lent' | 'borrowed' | 'all',
  ) {
    return this.debtsService.listForUser(user, { status, direction });
  }

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.debtsService.summaryForUser(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.findByIdForUser(user, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: CreateDebtDto) {
    return this.debtsService.createDebt(user, body, 'form');
  }

  @Post(':id/payments')
  recordPayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RecordPaymentDto,
  ) {
    return this.debtsService.recordPayment(user, id, body, 'form');
  }

  @Delete(':id/payments/:paymentId')
  deletePayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.debtsService.deletePayment(user, id, paymentId);
  }

  @Delete(':id')
  async deleteDebt(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.debtsService.deleteDebt(user, id);
    return { ok: true };
  }
}
```

- [ ] **Step 4: Register DebtsModule in app.module.ts**

```ts
import { DebtsModule } from './modules/debts/debts.module';
// ... add `DebtsModule` to imports array
```

- [ ] **Step 5: Verify build**

Run: `pnpm --filter api build`
Expected: no TS errors. App boots: `pnpm --filter api start:dev` for 5s, check no startup error then stop.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/debts/ apps/api/src/app.module.ts
git commit -m "feat(api): DebtsModule skeleton (controller + service stubs)"
```

---

## Task 9: Implement `DebtsService.createDebt` + test

**Files:**
- Modify: `apps/api/src/modules/debts/debts.service.ts`
- Create: `apps/api/src/modules/debts/debts.service.spec.ts`

- [ ] **Step 1: Write failing test for createDebt (lent)**

`debts.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Family } from '../families/entities/family.entity';
import { Fund } from '../funds/entities/fund.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { User } from '../users/entities/user.entity';
import { DebtsService } from './debts.service';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debt } from './entities/debt.entity';

describe('DebtsService', () => {
  let service: DebtsService;
  let dataSource: DataSource;
  let user: User;
  let fund: Fund;
  let category: Category;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST ?? 'localhost',
          port: Number(process.env.TEST_DB_PORT ?? 5432),
          username: process.env.TEST_DB_USER ?? 'postgres',
          password: process.env.TEST_DB_PASSWORD ?? 'postgres',
          database: process.env.TEST_DB_NAME ?? 'concord_test',
          entities: [User, Family, Fund, Category, Transaction, Debt, DebtPayment],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Debt, DebtPayment, Fund, Category, Transaction]),
        TransactionsModule,
      ],
      providers: [DebtsService],
    }).compile();

    service = moduleRef.get(DebtsService);
    dataSource = moduleRef.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
    const family = await dataSource.getRepository(Family).save({ name: 'Test' });
    user = await dataSource.getRepository(User).save({
      familyId: family.id, name: 'Chồng', role: 'husband',
      email: 'h@test.com', passwordHash: 'x',
    });
    fund = await dataSource.getRepository(Fund).save({
      familyId: family.id, name: 'Quỹ Chồng', type: 'personal',
      ownerId: user.id, balance: 50_000_000, purpose: 'spending',
    });
    category = await dataSource.getRepository(Category).save({
      familyId: family.id, name: 'Cho vay', isEssential: false,
    });
    await dataSource.getRepository(Category).save({
      familyId: family.id, name: 'Đi vay', isEssential: false,
    });
    await dataSource.getRepository(Category).save({
      familyId: family.id, name: 'Trả nợ', isEssential: false,
    });
  });

  it('createDebt lent: trừ balance + tạo Debt status=open + DebtPayment kind=open', async () => {
    const view = await service.createDebt(user, {
      direction: 'lent',
      counterpartyName: 'Hoàng',
      principal: 15_000_000,
      fundId: fund.id,
    }, 'form');

    expect(view.direction).toBe('lent');
    expect(view.remainingAmount).toBe(15_000_000);
    expect(view.status).toBe('open');

    const refreshedFund = await dataSource.getRepository(Fund).findOneByOrFail({ id: fund.id });
    expect(refreshedFund.balance).toBe(35_000_000);

    const payments = await dataSource.getRepository(DebtPayment).find({ where: { debtId: view.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].kind).toBe('open');
    expect(payments[0].amount).toBe(15_000_000);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `pnpm --filter api test -- debts.service`
Expected: FAIL with "not implemented".

- [ ] **Step 3: Implement createDebt**

Trong `debts.service.ts`, thay stub bằng:

```ts
async createDebt(
  user: User,
  input: CreateDebtDto,
  source: 'chat' | 'form',
  rawText?: string,
): Promise<DebtView> {
  const fund = await this.fundRepo.findOneBy({ id: input.fundId });
  if (!fund || fund.familyId !== user.familyId) {
    throw new BadRequestException('Quỹ không tồn tại.');
  }
  if (fund.type === 'personal' && fund.ownerId !== user.id) {
    throw new ForbiddenException('Không thể thao tác trên quỹ riêng của người khác.');
  }
  const categoryName = input.direction === 'lent' ? 'Cho vay' : 'Đi vay';
  const category = await this.categoryRepo.findOneBy({ familyId: user.familyId!, name: categoryName });

  const sign = input.direction === 'lent' ? -1 : 1;
  const openedAt = input.openedAt ? new Date(input.openedAt) : new Date();

  return this.dataSource.transaction(async (m) => {
    const txn = await this.transactionsService.createInternal({
      fundId: fund.id,
      userId: user.id,
      familyId: user.familyId!,
      amount: sign * input.principal,
      categoryId: category?.id ?? null,
      note: input.note ?? `${input.direction === 'lent' ? 'Cho' : 'Vay'} ${input.counterpartyName}`,
      date: openedAt,
      source,
      rawText: rawText ?? null,
    }, user, m);

    const debt = m.create(Debt, {
      familyId: user.familyId!,
      userId: user.id,
      fundId: fund.id,
      direction: input.direction,
      counterpartyName: input.counterpartyName,
      principal: input.principal,
      remainingAmount: input.principal,
      status: 'open',
      note: input.note ?? null,
      openedAt,
      closedAt: null,
    });
    const savedDebt = await m.save(debt);

    await m.save(m.create(DebtPayment, {
      debtId: savedDebt.id,
      transactionId: txn.id,
      kind: 'open',
      amount: input.principal,
    }));

    savedDebt.fund = fund;
    return toDebtView(savedDebt);
  });
}
```

- [ ] **Step 4: Run test (pass)**

Run: `pnpm --filter api test -- debts.service`
Expected: PASS.

- [ ] **Step 5: Add test cho borrowed**

Thêm test trong cùng file:

```ts
it('createDebt borrowed: cộng balance', async () => {
  const view = await service.createDebt(user, {
    direction: 'borrowed',
    counterpartyName: 'VCB',
    principal: 100_000_000,
    fundId: fund.id,
  }, 'form');

  expect(view.direction).toBe('borrowed');
  const refreshedFund = await dataSource.getRepository(Fund).findOneByOrFail({ id: fund.id });
  expect(refreshedFund.balance).toBe(150_000_000);
});

it('createDebt: từ chối quỹ riêng người khác', async () => {
  const otherFund = await dataSource.getRepository(Fund).save({
    familyId: user.familyId!, name: 'Quỹ Vợ', type: 'personal',
    ownerId: 'some-other-uuid-here-fake', balance: 0, purpose: 'spending',
  } as any);
  await expect(service.createDebt(user, {
    direction: 'lent', counterpartyName: 'X', principal: 1000, fundId: otherFund.id,
  }, 'form')).rejects.toThrow(/quỹ riêng/i);
});
```

Run: `pnpm --filter api test -- debts.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts apps/api/src/modules/debts/debts.service.spec.ts
git commit -m "feat(api): DebtsService.createDebt + tests"
```

---

## Task 10: Implement `listForUser` + `summaryForUser` + `findByIdForUser`

**Files:**
- Modify: `apps/api/src/modules/debts/debts.service.ts`
- Modify: `apps/api/src/modules/debts/debts.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Thêm vào spec:

```ts
it('listForUser: chỉ trả debts trên fund visible', async () => {
  await service.createDebt(user, { direction: 'lent', counterpartyName: 'A', principal: 1000, fundId: fund.id }, 'form');
  await service.createDebt(user, { direction: 'borrowed', counterpartyName: 'B', principal: 2000, fundId: fund.id }, 'form');
  const open = await service.listForUser(user, { status: 'open' });
  expect(open).toHaveLength(2);
  const lentOnly = await service.listForUser(user, { status: 'open', direction: 'lent' });
  expect(lentOnly).toHaveLength(1);
  expect(lentOnly[0].counterpartyName).toBe('A');
});

it('summaryForUser: chỉ tính open', async () => {
  await service.createDebt(user, { direction: 'lent', counterpartyName: 'A', principal: 5000, fundId: fund.id }, 'form');
  await service.createDebt(user, { direction: 'borrowed', counterpartyName: 'B', principal: 8000, fundId: fund.id }, 'form');
  const s = await service.summaryForUser(user);
  expect(s.totalLent).toBe(5000);
  expect(s.totalBorrowed).toBe(8000);
  expect(s.openLentCount).toBe(1);
  expect(s.openBorrowedCount).toBe(1);
});
```

Run: `pnpm --filter api test -- debts.service` → FAIL.

- [ ] **Step 2: Implement**

```ts
async listForUser(
  user: User,
  opts: { status?: 'open' | 'settled' | 'all'; direction?: 'lent' | 'borrowed' | 'all' },
): Promise<DebtView[]> {
  const fundIds = await this.visibleFundIds(user);
  if (fundIds.length === 0) return [];
  const where: any = { fundId: In(fundIds), familyId: user.familyId! };
  const status = opts.status ?? 'open';
  if (status !== 'all') where.status = status;
  const direction = opts.direction ?? 'all';
  if (direction !== 'all') where.direction = direction;

  const debts = await this.debtRepo.find({
    where, relations: ['fund'], order: { openedAt: 'DESC' },
  });
  return debts.map(toDebtView);
}

async summaryForUser(user: User): Promise<DebtSummary> {
  const list = await this.listForUser(user, { status: 'open', direction: 'all' });
  let totalLent = 0, totalBorrowed = 0, openLentCount = 0, openBorrowedCount = 0;
  for (const d of list) {
    if (d.direction === 'lent') { totalLent += d.remainingAmount; openLentCount++; }
    else { totalBorrowed += d.remainingAmount; openBorrowedCount++; }
  }
  return { totalLent, totalBorrowed, openLentCount, openBorrowedCount };
}

async findByIdForUser(user: User, id: string): Promise<{ debt: DebtView; payments: DebtPaymentView[] }> {
  const fundIds = await this.visibleFundIds(user);
  const debt = await this.debtRepo.findOne({
    where: { id, fundId: In(fundIds.length ? fundIds : ['00000000-0000-0000-0000-000000000000']) },
    relations: ['fund', 'payments', 'payments.transaction'],
  });
  if (!debt) throw new NotFoundException('Khoản nợ không tồn tại hoặc không thấy được.');
  const payments: DebtPaymentView[] = debt.payments
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      amount: p.amount,
      transactionId: p.transactionId,
      paidAt: p.transaction?.date.toISOString() ?? p.createdAt.toISOString(),
      note: p.transaction?.note ?? null,
    }));
  return { debt: toDebtView(debt), payments };
}
```

- [ ] **Step 3: Run tests (pass)**

Run: `pnpm --filter api test -- debts.service`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts apps/api/src/modules/debts/debts.service.spec.ts
git commit -m "feat(api): list/summary/detail debts"
```

---

## Task 11: Implement `recordPayment` + test partial + full settlement

**Files:**
- Modify: `apps/api/src/modules/debts/debts.service.ts`
- Modify: `apps/api/src/modules/debts/debts.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('recordPayment partial: giảm remaining, balance +', async () => {
  const debt = await service.createDebt(user, {
    direction: 'lent', counterpartyName: 'Hoàng', principal: 15_000_000, fundId: fund.id,
  }, 'form');
  const { debt: updated } = await service.recordPayment(user, debt.id, { amount: 5_000_000 }, 'form');
  expect(updated.remainingAmount).toBe(10_000_000);
  expect(updated.status).toBe('open');
  const f = await dataSource.getRepository(Fund).findOneByOrFail({ id: fund.id });
  // 50tr - 15tr (mở) + 5tr (trả) = 40tr
  expect(f.balance).toBe(40_000_000);
});

it('recordPayment full: settled + closedAt', async () => {
  const debt = await service.createDebt(user, {
    direction: 'lent', counterpartyName: 'A', principal: 1000, fundId: fund.id,
  }, 'form');
  const { debt: updated } = await service.recordPayment(user, debt.id, { amount: 1000 }, 'form');
  expect(updated.remainingAmount).toBe(0);
  expect(updated.status).toBe('settled');
  expect(updated.closedAt).not.toBeNull();
});

it('recordPayment > remaining: 400', async () => {
  const debt = await service.createDebt(user, {
    direction: 'lent', counterpartyName: 'A', principal: 1000, fundId: fund.id,
  }, 'form');
  await expect(service.recordPayment(user, debt.id, { amount: 2000 }, 'form'))
    .rejects.toThrow(/vượt quá|exceed/i);
});

it('recordPayment borrowed: balance giảm', async () => {
  const debt = await service.createDebt(user, {
    direction: 'borrowed', counterpartyName: 'VCB', principal: 100_000_000, fundId: fund.id,
  }, 'form');
  // 50tr + 100tr = 150tr
  await service.recordPayment(user, debt.id, { amount: 30_000_000 }, 'form');
  const f = await dataSource.getRepository(Fund).findOneByOrFail({ id: fund.id });
  expect(f.balance).toBe(120_000_000);
});
```

Run: FAIL.

- [ ] **Step 2: Implement**

```ts
async recordPayment(
  user: User,
  debtId: string,
  input: RecordPaymentDto,
  source: 'chat' | 'form',
): Promise<{ debt: DebtView; payment: DebtPaymentView }> {
  return this.dataSource.transaction(async (m) => {
    const debt = await m.findOne(Debt, { where: { id: debtId }, relations: ['fund'] });
    if (!debt) throw new NotFoundException('Khoản nợ không tồn tại.');
    const fundIds = await this.visibleFundIds(user);
    if (!fundIds.includes(debt.fundId)) throw new NotFoundException('Không thấy được khoản nợ này.');
    if (debt.fund.type === 'personal' && debt.fund.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    if (debt.status !== 'open') {
      throw new BadRequestException('Khoản nợ đã đóng.');
    }
    if (input.amount > debt.remainingAmount) {
      throw new BadRequestException(
        `Số tiền trả (${input.amount}) vượt quá số còn lại (${debt.remainingAmount}).`,
      );
    }

    const category = await m.findOneBy(Category, { familyId: user.familyId!, name: 'Trả nợ' });
    const sign = debt.direction === 'lent' ? 1 : -1;
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

    const txn = await this.transactionsService.createInternal({
      fundId: debt.fundId,
      userId: user.id,
      familyId: user.familyId!,
      amount: sign * input.amount,
      categoryId: category?.id ?? null,
      note: input.note ?? `${debt.direction === 'lent' ? `${debt.counterpartyName} trả` : `Trả ${debt.counterpartyName}`}`,
      date: paidAt,
      source,
    }, user, m);

    debt.remainingAmount = debt.remainingAmount - input.amount;
    if (debt.remainingAmount === 0) {
      debt.status = 'settled';
      debt.closedAt = new Date();
    }
    const savedDebt = await m.save(debt);

    const payment = await m.save(m.create(DebtPayment, {
      debtId: savedDebt.id,
      transactionId: txn.id,
      kind: 'repayment',
      amount: input.amount,
    }));

    return {
      debt: toDebtView(savedDebt),
      payment: {
        id: payment.id,
        kind: payment.kind,
        amount: payment.amount,
        transactionId: txn.id,
        paidAt: txn.date.toISOString(),
        note: txn.note,
      },
    };
  });
}
```

- [ ] **Step 3: Run tests (pass)**

Run: `pnpm --filter api test -- debts.service`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts apps/api/src/modules/debts/debts.service.spec.ts
git commit -m "feat(api): recordPayment with full-settlement"
```

---

## Task 12: Implement `deletePayment` + `deleteDebt`

**Files:**
- Modify: `apps/api/src/modules/debts/debts.service.ts`
- Modify: `apps/api/src/modules/debts/debts.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('deletePayment: revert balance + remaining; reopen nếu trước đó settled', async () => {
  const debt = await service.createDebt(user, {
    direction: 'lent', counterpartyName: 'A', principal: 1000, fundId: fund.id,
  }, 'form');
  const { payment } = await service.recordPayment(user, debt.id, { amount: 1000 }, 'form');
  // debt giờ settled, balance = 50tr - 1000 + 1000 = 50tr

  await service.deletePayment(user, debt.id, payment.id);
  const refreshed = (await service.findByIdForUser(user, debt.id)).debt;
  expect(refreshed.remainingAmount).toBe(1000);
  expect(refreshed.status).toBe('open');
  expect(refreshed.closedAt).toBeNull();
  const f = await dataSource.getRepository(Fund).findOneByOrFail({ id: fund.id });
  expect(f.balance).toBe(49_000_000); // 50tr - 1000 (mở vẫn còn) + 0
});

it('deletePayment: không cho phép xoá kind=open', async () => {
  const debt = await service.createDebt(user, {
    direction: 'lent', counterpartyName: 'A', principal: 1000, fundId: fund.id,
  }, 'form');
  const openPayment = await dataSource.getRepository(DebtPayment).findOneByOrFail({ debtId: debt.id, kind: 'open' });
  await expect(service.deletePayment(user, debt.id, openPayment.id)).rejects.toThrow(/dùng xoá khoản nợ/i);
});

it('deleteDebt: xoá tất cả transactions liên quan, balance revert', async () => {
  const debt = await service.createDebt(user, {
    direction: 'lent', counterpartyName: 'A', principal: 5000, fundId: fund.id,
  }, 'form');
  await service.recordPayment(user, debt.id, { amount: 2000 }, 'form');
  await service.deleteDebt(user, debt.id);
  const f = await dataSource.getRepository(Fund).findOneByOrFail({ id: fund.id });
  expect(f.balance).toBe(50_000_000);
  await expect(service.findByIdForUser(user, debt.id)).rejects.toThrow();
});
```

Run: FAIL.

- [ ] **Step 2: Implement**

```ts
async deletePayment(user: User, debtId: string, paymentId: string): Promise<DebtView> {
  return this.dataSource.transaction(async (m) => {
    const debt = await m.findOne(Debt, { where: { id: debtId }, relations: ['fund'] });
    if (!debt) throw new NotFoundException();
    const fundIds = await this.visibleFundIds(user);
    if (!fundIds.includes(debt.fundId)) throw new NotFoundException();
    if (debt.fund.type === 'personal' && debt.fund.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    const payment = await m.findOneBy(DebtPayment, { id: paymentId, debtId });
    if (!payment) throw new NotFoundException('Lần trả không tồn tại.');
    if (payment.kind === 'open') {
      throw new BadRequestException('Không xoá lần ghi nhận mở khoản — dùng xoá khoản nợ.');
    }

    await this.transactionsService.deleteByIdInternal(payment.transactionId, user, m);
    await m.remove(payment);

    debt.remainingAmount = debt.remainingAmount + payment.amount;
    if (debt.status === 'settled') {
      debt.status = 'open';
      debt.closedAt = null;
    }
    const saved = await m.save(debt);
    return toDebtView(saved);
  });
}

async deleteDebt(user: User, debtId: string): Promise<void> {
  await this.dataSource.transaction(async (m) => {
    const debt = await m.findOne(Debt, { where: { id: debtId }, relations: ['fund', 'payments'] });
    if (!debt) throw new NotFoundException();
    const fundIds = await this.visibleFundIds(user);
    if (!fundIds.includes(debt.fundId)) throw new NotFoundException();
    if (debt.fund.type === 'personal' && debt.fund.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    for (const p of debt.payments) {
      await this.transactionsService.deleteByIdInternal(p.transactionId, user, m);
    }
    await m.remove(debt.payments);
    await m.remove(debt);
  });
}
```

- [ ] **Step 3: Run tests (pass)**

Run: `pnpm --filter api test -- debts.service`
Expected: PASS all.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts apps/api/src/modules/debts/debts.service.spec.ts
git commit -m "feat(api): deletePayment + deleteDebt with balance revert"
```

---

## Task 13: Parser tools (`open_debt`, `record_debt_payment`)

**Files:**
- Modify: `apps/api/src/agent/subagents/parser/parser.tools.ts`

- [ ] **Step 1: Read existing tools file**

Run: `cat apps/api/src/agent/subagents/parser/parser.tools.ts | head -40`

- [ ] **Step 2: Add input types**

Thêm vào file:

```ts
export interface OpenDebtInput {
  direction: 'lent' | 'borrowed';
  counterpartyName: string;
  amount: number;
  fundName: string;
  note?: string;
  openedAt?: string;
}

export interface RecordDebtPaymentInput {
  debt_id: string;
  amount: number;
  note?: string;
  paidAt?: string;
}
```

- [ ] **Step 3: Add 2 tool definitions to `parserTools` array**

```ts
{
  name: 'open_debt',
  description: 'Mở khoản cho vay (lent: bạn cho người khác mượn tiền) hoặc đi vay (borrowed: bạn mượn tiền). Sẽ tự tạo transaction cash flow: lent → trừ quỹ; borrowed → cộng quỹ.',
  input_schema: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['lent', 'borrowed'] },
      counterpartyName: { type: 'string', description: 'Tên người hoặc đơn vị: "Hoàng", "VCB", "Mẹ"' },
      amount: { type: 'integer', description: 'Số tiền nguyên VND, luôn dương' },
      fundName: { type: 'string', description: 'Exact tên quỹ từ context' },
      note: { type: 'string' },
      openedAt: { type: 'string', description: 'ISO date, mặc định now' },
    },
    required: ['direction', 'counterpartyName', 'amount', 'fundName'],
  },
},
{
  name: 'record_debt_payment',
  description: 'Ghi nhận một lần trả nợ (partial hoặc full) cho khoản đang mở. debt_id phải lấy từ context "Khoản nợ đang mở".',
  input_schema: {
    type: 'object',
    properties: {
      debt_id: { type: 'string', description: 'UUID của khoản nợ từ context' },
      amount: { type: 'integer', description: 'Số tiền trả lần này, dương' },
      note: { type: 'string' },
      paidAt: { type: 'string' },
    },
    required: ['debt_id', 'amount'],
  },
},
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter api build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/subagents/parser/parser.tools.ts
git commit -m "feat(api): parser tools for open_debt + record_debt_payment"
```

---

## Task 14: Wire parser handlers + context block + synthesizeReply

**Files:**
- Modify: `apps/api/src/agent/subagents/parser/parser.subagent.ts`
- Modify: `apps/api/src/agent/agent.module.ts`

- [ ] **Step 1: Import DebtsModule in AgentModule**

```ts
import { DebtsModule } from '../modules/debts/debts.module';
// add to imports
```

- [ ] **Step 2: Inject DebtsService + Debt repo in ParserSubagent**

Trong `parser.subagent.ts` constructor thêm:

```ts
private readonly debtsService: DebtsService,
@InjectRepository(Debt)
private readonly debtRepo: Repository<Debt>,
```

Import:
```ts
import { Debt } from '../../../modules/debts/entities/debt.entity';
import { DebtsService } from '../../../modules/debts/debts.service';
```

- [ ] **Step 3: Add ParseAction types**

Thêm vào union `ParseAction`:

```ts
| {
    kind: 'debt_opened';
    id: string;
    direction: 'lent' | 'borrowed';
    counterpartyName: string;
    amount: number;
    fundName: string;
  }
| {
    kind: 'debt_payment_recorded';
    debtId: string;
    amount: number;
    remainingAmount: number;
    settled: boolean;
    counterpartyName: string;
    direction: 'lent' | 'borrowed';
  }
```

- [ ] **Step 4: Add context block trong `buildContext`**

Trước section "Ngày quan trọng đã có trong hệ thống", thêm:

```ts
const visibleFundIdSet = new Set(allFamilyFunds
  .filter((f) => f.type === 'joint' || f.ownerId === user.id)
  .map((f) => f.id));
const openDebts = await this.debtRepo.find({
  where: { familyId: user.familyId!, status: 'open' },
  relations: ['fund'],
  order: { openedAt: 'DESC' },
  take: 10,
});
const visibleDebts = openDebts.filter((d) => visibleFundIdSet.has(d.fundId));
const debtLines = visibleDebts.length
  ? visibleDebts.map((d) => {
      const direction = d.direction === 'lent' ? `CHO ${d.counterpartyName} VAY` : `BẠN VAY ${d.counterpartyName}`;
      const remain = d.remainingAmount.toLocaleString('vi-VN');
      const principal = d.principal.toLocaleString('vi-VN');
      const opened = d.openedAt.toLocaleDateString('vi-VN');
      return `  - id=\`${d.id}\` · ${direction} · còn lại ${remain}đ / gốc ${principal}đ · quỹ ${d.fund.name} · mở ${opened}`;
    })
  : ['  (chưa có khoản nợ nào đang mở)'];
```

Rồi append vào return array (sau "Ngày quan trọng đã có trong hệ thống" section):

```ts
'',
'### Khoản nợ đang mở',
...debtLines,
'',
'> Khi user nói "X trả Y" hoặc "trả X Y" → dùng record_debt_payment với debt_id từ list trên.',
'> Match counterpartyName case-insensitive, cho phép prefix ("anh Hoàng" match "Hoàng").',
'> Nếu nhiều khoản với cùng person → gọi ask_clarification.',
'> Khi user mở khoản mới ("cho X vay Y", "tôi vay X Y") → dùng open_debt.',
'> Mặc định fundName = quỹ cá nhân của current user khi user không nói rõ quỹ.',
```

- [ ] **Step 5: Add 2 handler branches trong `handleResponse`**

Trước `else if (block.name === 'propose_important_date')`:

```ts
} else if (block.name === 'open_debt') {
  const input = block.input as OpenDebtInput;
  try {
    const fund = await this.fundRepo.findOneBy({
      familyId: user.familyId!, name: input.fundName,
    });
    if (!fund) throw new Error(`Fund "${input.fundName}" không tồn tại.`);
    const view = await this.debtsService.createDebt(user, {
      direction: input.direction,
      counterpartyName: input.counterpartyName,
      principal: input.amount,
      fundId: fund.id,
      note: input.note,
      openedAt: input.openedAt,
    }, 'chat', rawText);
    actions.push({
      kind: 'debt_opened',
      id: view.id,
      direction: view.direction,
      counterpartyName: view.counterpartyName,
      amount: view.principal,
      fundName: view.fundName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`open_debt failed: ${msg}`);
    actions.push({ kind: 'tool_error', toolName: 'open_debt', message: msg });
  }
} else if (block.name === 'record_debt_payment') {
  const input = block.input as RecordDebtPaymentInput;
  try {
    const { debt, payment } = await this.debtsService.recordPayment(user, input.debt_id, {
      amount: input.amount, note: input.note, paidAt: input.paidAt,
    }, 'chat');
    actions.push({
      kind: 'debt_payment_recorded',
      debtId: debt.id,
      amount: payment.amount,
      remainingAmount: debt.remainingAmount,
      settled: debt.status === 'settled',
      counterpartyName: debt.counterpartyName,
      direction: debt.direction,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`record_debt_payment failed: ${msg}`);
    actions.push({ kind: 'tool_error', toolName: 'record_debt_payment', message: msg });
  }
}
```

Imports cần thêm:
```ts
import { OpenDebtInput, RecordDebtPaymentInput } from './parser.tools';
```

- [ ] **Step 6: Extend `synthesizeReply`**

Thêm xử lý 2 action types mới (cuối `synthesizeReply`, trước `errors`):

```ts
const debtOpened = actions.filter(
  (a): a is Extract<ParseAction, { kind: 'debt_opened' }> => a.kind === 'debt_opened',
);
const debtPaid = actions.filter(
  (a): a is Extract<ParseAction, { kind: 'debt_payment_recorded' }> => a.kind === 'debt_payment_recorded',
);
for (const d of debtOpened) {
  const verb = d.direction === 'lent' ? `Cho ${d.counterpartyName} vay` : `Vay ${d.counterpartyName}`;
  const icon = d.direction === 'lent' ? '💸' : '📥';
  parts.push(`${icon} Đã ghi ${verb} ${formatVND(d.amount)} • ${d.fundName}`);
}
for (const p of debtPaid) {
  if (p.settled) {
    const what = p.direction === 'lent' ? `${p.counterpartyName} trả xong` : `Trả xong cho ${p.counterpartyName}`;
    parts.push(`🎉 ${what}! Khoản nợ đã đóng.`);
  } else {
    const what = p.direction === 'lent' ? `${p.counterpartyName} trả` : `Trả ${p.counterpartyName}`;
    parts.push(`✅ ${what} ${formatVND(p.amount)} • còn ${formatVND(p.remainingAmount)}`);
  }
}
```

- [ ] **Step 7: Add Debt to ParserSubagent's TypeOrmModule.forFeature**

Trong `agent.module.ts` (hoặc nơi đăng ký repo cho parser):

Run: `grep -n "TypeOrmModule\|Fund\|Category" apps/api/src/agent/agent.module.ts`

Thêm `Debt` vào `TypeOrmModule.forFeature([..., Debt])`. Import `DebtsModule` để có `DebtsService`.

- [ ] **Step 8: Verify build**

Run: `pnpm --filter api build`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/agent/
git commit -m "feat(api): parser handlers + context for debt tools"
```

---

## Task 15: Update parser skill.md

**Files:**
- Modify: `apps/api/src/agent/subagents/parser/skill.md`

- [ ] **Step 1: Read current skill.md** để biết section flow.

Run: `wc -l apps/api/src/agent/subagents/parser/skill.md`

- [ ] **Step 2: Append section "Khoản vay & cho vay"**

Thêm trước cuối file (sau các pattern hiện có):

```markdown
## Khoản vay & cho vay (open_debt / record_debt_payment)

Nhận diện pattern:

**Mở khoản cho vay** (direction=lent — bạn cho người khác mượn):
- "cho [tên] vay [số]" / "cho [tên] mượn [số]"
- "[tên] mượn [số] của tôi"
→ Gọi `open_debt(direction='lent', counterpartyName='[tên]', amount=<số>, fundName=<quỹ cá nhân của current user nếu không nói rõ>)`

**Mở khoản đi vay** (direction=borrowed — bạn mượn của người khác):
- "tôi vay [tên/ngân hàng] [số]"
- "mượn [tên] [số]"
- "vay [tên] [số]"
→ Gọi `open_debt(direction='borrowed', ...)`

**Ghi trả nợ** (record_debt_payment): chỉ dùng khi có khoản đang mở match trong context "Khoản nợ đang mở":
- "[tên] trả [số]" → match khoản lent với [tên]
- "trả [tên/ngân hàng] [số]" → match khoản borrowed với [tên]
- "trả nợ [tên] [số]" → match khoản với [tên]
→ Gọi `record_debt_payment(debt_id=<từ context>, amount=<số>)`

Lưu ý:
- Match counterpartyName case-insensitive, cho phép prefix ("anh Hoàng" match "Hoàng", "ngân hàng VCB" match "VCB").
- Nếu user "trả Hoàng 5tr" mà context có 2 khoản lent với Hoàng → gọi `ask_clarification` hỏi rõ khoản nào.
- Nếu không tìm thấy khoản match → gọi `ask_clarification` ("Tôi không thấy khoản nợ nào với [tên]. Bạn có muốn tôi tạo khoản mới không?").
- Phân biệt với expense thường: "trả tiền điện" KHÔNG phải debt — đó là expense vào quỹ. Chỉ trigger debt khi có chủ thể người/đơn vị + động từ vay/mượn/trả-nợ.
- Mặc định fundName = quỹ cá nhân của current user nếu user không nói rõ ("vay từ quỹ chung 10tr" thì fundName='Quỹ chung').
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/agent/subagents/parser/skill.md
git commit -m "feat(api): parser skill — debt patterns"
```

---

## Task 16: Manual E2E API smoke test

**Files:** none (manual)

- [ ] **Step 1: Start API**

Run: `pnpm --filter api start:dev`
Đợi log "Nest application successfully started".

- [ ] **Step 2: Login + lấy JWT**

Run:
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"chong@test.com","password":"<password>"}' | jq -r .access_token)
echo $TOKEN
```
Expected: non-empty JWT.

- [ ] **Step 3: Test chat — mở khoản lent**

```bash
curl -s -X POST http://localhost:3001/api/chat/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"cho Hoàng vay 15 triệu"}' | jq
```
Expected: actions array có `kind:'debt_opened'`, reply chứa "💸 Đã ghi Cho Hoàng vay".

- [ ] **Step 4: Test chat — ghi trả partial**

```bash
curl -s -X POST http://localhost:3001/api/chat/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hoàng trả 5 triệu"}' | jq
```
Expected: `kind:'debt_payment_recorded'`, `remainingAmount: 10_000_000`, reply "✅ Hoàng trả 5.000.000đ • còn 10.000.000đ".

- [ ] **Step 5: Test endpoints**

```bash
curl -s http://localhost:3001/api/debts -H "Authorization: Bearer $TOKEN" | jq
curl -s http://localhost:3001/api/debts/summary -H "Authorization: Bearer $TOKEN" | jq
```
Expected: list 1 debt với remaining=10tr; summary `{totalLent: 10000000, openLentCount: 1, ...}`.

- [ ] **Step 6: Cleanup test data nếu cần**

Run: `pnpm --filter api reset:txn -- --keep-opening` (nếu muốn).

- [ ] **Step 7: Commit nếu có fix nào phát sinh** (otherwise skip).

---

## Task 17: Frontend — types + api client

**Files:**
- Create: `apps/web/features/debts/types.ts`
- Create: `apps/web/features/debts/api.ts`

- [ ] **Step 1: Write types**

`types.ts`:

```ts
export type DebtDirection = 'lent' | 'borrowed';
export type DebtStatus = 'open' | 'settled';

export interface DebtView {
  id: string;
  direction: DebtDirection;
  counterpartyName: string;
  principal: number;
  remainingAmount: number;
  paidAmount: number;
  status: DebtStatus;
  fundId: string;
  fundName: string;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
}

export interface DebtPaymentView {
  id: string;
  kind: 'open' | 'repayment';
  amount: number;
  transactionId: string;
  paidAt: string;
  note: string | null;
}

export interface DebtSummary {
  totalLent: number;
  totalBorrowed: number;
  openLentCount: number;
  openBorrowedCount: number;
}

export interface DebtDetail {
  debt: DebtView;
  payments: DebtPaymentView[];
}
```

- [ ] **Step 2: Write api client**

Run: `grep -l "apiFetch\|API_BASE" apps/web/lib/ apps/web/features/ -r 2>/dev/null | head -3` để tìm helper hiện có.

Dùng existing helper (vd `apiFetch` từ `lib/api.ts`). `api.ts`:

```ts
import { apiFetch } from '@/lib/api';
import type { DebtDetail, DebtSummary, DebtView } from './types';

export const debtsApi = {
  list: (params?: { status?: 'open' | 'settled' | 'all'; direction?: 'lent' | 'borrowed' | 'all' }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.direction) qs.set('direction', params.direction);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<DebtView[]>(`/api/debts${suffix}`);
  },
  summary: () => apiFetch<DebtSummary>('/api/debts/summary'),
  detail: (id: string) => apiFetch<DebtDetail>(`/api/debts/${id}`),
  create: (body: {
    direction: 'lent' | 'borrowed';
    counterpartyName: string;
    principal: number;
    fundId: string;
    note?: string;
    openedAt?: string;
  }) => apiFetch<DebtView>('/api/debts', { method: 'POST', body: JSON.stringify(body) }),
  recordPayment: (id: string, body: { amount: number; note?: string; paidAt?: string }) =>
    apiFetch<{ debt: DebtView; payment: { id: string; amount: number } }>(`/api/debts/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deletePayment: (id: string, paymentId: string) =>
    apiFetch<DebtView>(`/api/debts/${id}/payments/${paymentId}`, { method: 'DELETE' }),
  deleteDebt: (id: string) =>
    apiFetch<{ ok: true }>(`/api/debts/${id}`, { method: 'DELETE' }),
};
```

(Nếu codebase dùng helper khác, adapt — pattern: relative path + token tự gắn).

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/debts/types.ts apps/web/features/debts/api.ts
git commit -m "feat(web): debts feature types + api client"
```

---

## Task 18: Frontend — SummaryCards + DebtCard primitives

**Files:**
- Create: `apps/web/features/debts/components/DebtsSummaryCards.tsx`
- Create: `apps/web/features/debts/components/DebtCard.tsx`

- [ ] **Step 1: Write DebtsSummaryCards**

```tsx
'use client';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { DebtSummary } from '../types';

function formatVND(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function DebtsSummaryCards({ summary }: { summary: DebtSummary }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-emerald-200/40 bg-emerald-50/50 dark:bg-emerald-950/30 p-5">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm">
          <ArrowDownLeft className="size-4" />
          Người khác nợ bạn
        </div>
        <div className="mt-2 text-2xl font-semibold">{formatVND(summary.totalLent)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {summary.openLentCount} khoản đang mở
        </div>
      </div>
      <div className="rounded-2xl border border-orange-200/40 bg-orange-50/50 dark:bg-orange-950/30 p-5">
        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-sm">
          <ArrowUpRight className="size-4" />
          Bạn nợ người khác
        </div>
        <div className="mt-2 text-2xl font-semibold">{formatVND(summary.totalBorrowed)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {summary.openBorrowedCount} khoản đang mở
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write DebtCard**

```tsx
'use client';
import type { DebtView } from '../types';

function formatVND(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function DebtCard({
  debt,
  onRecordPayment,
  onOpenDetail,
}: {
  debt: DebtView;
  onRecordPayment: (d: DebtView) => void;
  onOpenDetail: (d: DebtView) => void;
}) {
  const percentPaid = debt.principal > 0 ? Math.round((debt.paidAmount / debt.principal) * 100) : 0;
  const tint = debt.direction === 'lent' ? 'border-emerald-200/40' : 'border-orange-200/40';
  const verb = debt.direction === 'lent' ? 'Cho vay' : 'Đi vay';

  return (
    <div className={`rounded-xl border ${tint} bg-card p-4`}>
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => onOpenDetail(debt)}
          className="text-left flex-1"
        >
          <div className="font-medium">{debt.counterpartyName}</div>
          <div className="text-xs text-muted-foreground">{verb} · Quỹ {debt.fundName}</div>
        </button>
        {debt.status === 'open' && (
          <button
            onClick={() => onRecordPayment(debt)}
            className="rounded-md bg-primary text-primary-foreground text-sm px-3 py-1.5 hover:opacity-90"
          >
            Ghi trả
          </button>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-semibold">{formatVND(debt.remainingAmount)}</span>
        <span className="text-xs text-muted-foreground">/ {formatVND(debt.principal)}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${debt.direction === 'lent' ? 'bg-emerald-500' : 'bg-orange-500'}`}
          style={{ width: `${percentPaid}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Mở {new Date(debt.openedAt).toLocaleDateString('vi-VN')}
        {debt.status === 'settled' && ' · Đã đóng'}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/debts/components/
git commit -m "feat(web): DebtsSummaryCards + DebtCard"
```

---

## Task 19: Frontend — RecordPaymentDialog + CreateDebtDialog

**Files:**
- Create: `apps/web/features/debts/components/RecordPaymentDialog.tsx`
- Create: `apps/web/features/debts/components/CreateDebtDialog.tsx`

- [ ] **Step 1: Identify existing Dialog primitive**

Run: `find apps/web/components/ui -type f | head -20`
Expected: tìm `dialog.tsx` (Radix) hoặc `modal.tsx` hiện có.

- [ ] **Step 2: Write RecordPaymentDialog**

```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DebtView } from '../types';
import { debtsApi } from '../api';

function formatVND(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function RecordPaymentDialog({
  debt,
  open,
  onOpenChange,
  onSuccess,
}: {
  debt: DebtView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!debt) return null;

  const remaining = debt.remainingAmount;
  const willSettle = typeof amount === 'number' && amount === remaining;
  const willRemain = typeof amount === 'number' ? Math.max(0, remaining - amount) : remaining;

  async function submit() {
    if (typeof amount !== 'number' || amount <= 0) {
      setError('Nhập số tiền hợp lệ.');
      return;
    }
    if (amount > remaining) {
      setError(`Vượt quá số còn lại (${formatVND(remaining)}).`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await debtsApi.recordPayment(debt.id, { amount, note: note || undefined });
      onSuccess();
      onOpenChange(false);
      setAmount('');
      setNote('');
    } catch (e: any) {
      setError(e?.message ?? 'Lỗi không xác định');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận trả nợ — {debt.counterpartyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Còn lại: <span className="font-medium text-foreground">{formatVND(remaining)}</span>
          </div>
          <div>
            <label className="text-sm font-medium">Số tiền trả (VND)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
              max={remaining}
              min={1}
            />
          </div>
          {typeof amount === 'number' && amount > 0 && (
            <div className="text-sm">
              Sau khi trả: <span className="font-medium">{formatVND(willRemain)}</span>
              {willSettle && <span className="ml-2 text-emerald-600">— sẽ đóng khoản này</span>}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Ghi chú (tuỳ chọn)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Đang ghi...' : 'Xác nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

(Nếu codebase chưa có `Button`/`Dialog`/`Input`/`Textarea` shadcn, dùng raw HTML elements với Tailwind classes tương đương — adapt theo pattern feature khác như `features/transactions/`).

- [ ] **Step 3: Write CreateDebtDialog**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fundsApi } from '@/features/funds/api';   // adapt theo path thực
import { debtsApi } from '../api';

interface FundOption { id: string; name: string; }

export function CreateDebtDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [counterpartyName, setCounterparty] = useState('');
  const [principal, setPrincipal] = useState<number | ''>('');
  const [fundId, setFundId] = useState('');
  const [note, setNote] = useState('');
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fundsApi.list().then((list: any[]) => {
      const writable = list.filter(
        (f) => f.purpose === 'spending' && (f.type === 'joint' || f.isOwned),
      );
      setFunds(writable.map((f) => ({ id: f.id, name: f.name })));
      if (writable[0]) setFundId(writable[0].id);
    });
  }, [open]);

  async function submit() {
    if (!counterpartyName.trim()) return setError('Nhập tên bên kia.');
    if (typeof principal !== 'number' || principal <= 0) return setError('Số tiền không hợp lệ.');
    if (!fundId) return setError('Chọn quỹ.');
    setSubmitting(true);
    setError(null);
    try {
      await debtsApi.create({
        direction, counterpartyName: counterpartyName.trim(),
        principal, fundId, note: note || undefined,
      });
      onSuccess(); onOpenChange(false);
      setCounterparty(''); setPrincipal(''); setNote('');
    } catch (e: any) {
      setError(e?.message ?? 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo khoản mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-md border py-2 text-sm ${direction === 'lent' ? 'bg-emerald-500/10 border-emerald-500' : ''}`}
              onClick={() => setDirection('lent')}
            >Cho vay</button>
            <button
              className={`flex-1 rounded-md border py-2 text-sm ${direction === 'borrowed' ? 'bg-orange-500/10 border-orange-500' : ''}`}
              onClick={() => setDirection('borrowed')}
            >Đi vay</button>
          </div>
          <div>
            <label className="text-sm font-medium">Tên bên kia</label>
            <Input value={counterpartyName} onChange={(e) => setCounterparty(e.target.value)} placeholder="Hoàng, VCB, Mẹ..." />
          </div>
          <div>
            <label className="text-sm font-medium">Số tiền (VND)</label>
            <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value ? Number(e.target.value) : '')} min={1} />
          </div>
          <div>
            <label className="text-sm font-medium">Quỹ</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={fundId}
              onChange={(e) => setFundId(e.target.value)}
            >
              {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Ghi chú (tuỳ chọn)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Huỷ</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo khoản'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note: nếu `fundsApi.list` trả về schema khác, adapt — quan trọng là lấy danh sách `spending` writable.

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/debts/components/RecordPaymentDialog.tsx apps/web/features/debts/components/CreateDebtDialog.tsx
git commit -m "feat(web): RecordPayment + CreateDebt dialogs"
```

---

## Task 20: Frontend — DebtDetailDrawer

**Files:**
- Create: `apps/web/features/debts/components/DebtDetailDrawer.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { debtsApi } from '../api';
import type { DebtDetail } from '../types';

function formatVND(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function DebtDetailDrawer({
  debtId,
  open,
  onOpenChange,
  onChanged,
}: {
  debtId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !debtId) return;
    debtsApi.detail(debtId).then(setDetail).catch(() => setDetail(null));
  }, [open, debtId]);

  async function reload() {
    if (debtId) setDetail(await debtsApi.detail(debtId));
    onChanged();
  }

  async function removePayment(paymentId: string) {
    if (!debtId) return;
    if (!confirm('Xoá lần trả này? Số tiền sẽ được hoàn lại quỹ.')) return;
    setBusy(true);
    try {
      await debtsApi.deletePayment(debtId, paymentId);
      await reload();
    } finally { setBusy(false); }
  }

  async function removeDebt() {
    if (!debtId) return;
    if (!confirm('Xoá toàn bộ khoản nợ và TẤT CẢ transaction liên quan? Hành động không hoàn tác.')) return;
    setBusy(true);
    try {
      await debtsApi.deleteDebt(debtId);
      onChanged();
      onOpenChange(false);
    } finally { setBusy(false); }
  }

  if (!detail) return null;
  const d = detail.debt;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{d.counterpartyName} — {d.direction === 'lent' ? 'Cho vay' : 'Đi vay'}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Còn lại</div>
            <div className="text-xl font-semibold">{formatVND(d.remainingAmount)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Gốc {formatVND(d.principal)} · Quỹ {d.fundName} · Mở {new Date(d.openedAt).toLocaleDateString('vi-VN')}
            </div>
            {d.note && <div className="text-sm mt-2">{d.note}</div>}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Lịch sử</div>
            <div className="space-y-2">
              {detail.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <div>
                      {p.kind === 'open' ? 'Mở khoản' : 'Trả'} {formatVND(p.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.paidAt).toLocaleDateString('vi-VN')}
                      {p.note ? ` · ${p.note}` : ''}
                    </div>
                  </div>
                  {p.kind === 'repayment' && (
                    <button
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      onClick={() => removePayment(p.id)}
                      disabled={busy}
                    >Xoá</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button variant="destructive" onClick={removeDebt} disabled={busy} className="w-full">
            Xoá toàn bộ khoản nợ
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Nếu chưa có `Sheet` shadcn, dùng Dialog full-screen hoặc fixed panel — adapt.

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/debts/components/DebtDetailDrawer.tsx
git commit -m "feat(web): DebtDetailDrawer"
```

---

## Task 21: Frontend — DebtsList + DebtsPageClient

**Files:**
- Create: `apps/web/features/debts/components/DebtsList.tsx`
- Create: `apps/web/features/debts/components/DebtsPageClient.tsx`

- [ ] **Step 1: Write DebtsList**

```tsx
'use client';
import type { DebtView } from '../types';
import { DebtCard } from './DebtCard';

export function DebtsList({
  debts,
  onRecordPayment,
  onOpenDetail,
}: {
  debts: DebtView[];
  onRecordPayment: (d: DebtView) => void;
  onOpenDetail: (d: DebtView) => void;
}) {
  if (debts.length === 0) {
    return <div className="text-sm text-muted-foreground py-12 text-center">Chưa có khoản nào.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {debts.map((d) => (
        <DebtCard key={d.id} debt={d} onRecordPayment={onRecordPayment} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write DebtsPageClient**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { debtsApi } from '../api';
import type { DebtSummary, DebtView } from '../types';
import { DebtsSummaryCards } from './DebtsSummaryCards';
import { DebtsList } from './DebtsList';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { CreateDebtDialog } from './CreateDebtDialog';
import { DebtDetailDrawer } from './DebtDetailDrawer';

type Tab = 'lent' | 'borrowed' | 'settled';

export function DebtsPageClient({
  initialDebts,
  initialSummary,
}: {
  initialDebts: DebtView[];
  initialSummary: DebtSummary;
}) {
  const [tab, setTab] = useState<Tab>('lent');
  const [debts, setDebts] = useState<DebtView[]>(initialDebts);
  const [summary, setSummary] = useState<DebtSummary>(initialSummary);
  const [paymentTarget, setPaymentTarget] = useState<DebtView | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTab = useCallback(async (t: Tab) => {
    if (t === 'settled') return debtsApi.list({ status: 'settled', direction: 'all' });
    return debtsApi.list({ status: 'open', direction: t });
  }, []);

  async function refresh() {
    const [list, s] = await Promise.all([fetchTab(tab), debtsApi.summary()]);
    setDebts(list);
    setSummary(s);
  }

  useEffect(() => { fetchTab(tab).then(setDebts); }, [tab, fetchTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nợ & Cho vay</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1" /> Tạo khoản mới
        </Button>
      </div>

      <DebtsSummaryCards summary={summary} />

      <div className="flex gap-2 border-b">
        {(['lent', 'borrowed', 'settled'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
          >
            {t === 'lent' ? 'Cho vay' : t === 'borrowed' ? 'Đi vay' : 'Đã đóng'}
          </button>
        ))}
      </div>

      <DebtsList
        debts={debts}
        onRecordPayment={(d) => setPaymentTarget(d)}
        onOpenDetail={(d) => setDetailId(d.id)}
      />

      <RecordPaymentDialog
        debt={paymentTarget}
        open={!!paymentTarget}
        onOpenChange={(o) => !o && setPaymentTarget(null)}
        onSuccess={refresh}
      />
      <CreateDebtDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refresh}
      />
      <DebtDetailDrawer
        debtId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/debts/components/DebtsList.tsx apps/web/features/debts/components/DebtsPageClient.tsx
git commit -m "feat(web): DebtsList + DebtsPageClient"
```

---

## Task 22: Frontend — page `/debts`

**Files:**
- Create: `apps/web/app/(app)/debts/page.tsx`

- [ ] **Step 1: Check existing pattern**

Run: `cat apps/web/app/\(app\)/transactions/page.tsx 2>/dev/null | head -30`
Để biết server-side fetch pattern + auth (cookie/JWT) hiện tại.

- [ ] **Step 2: Write page**

```tsx
import { debtsApi } from '@/features/debts/api';
import { DebtsPageClient } from '@/features/debts/components/DebtsPageClient';

export const dynamic = 'force-dynamic';

export default async function DebtsPage() {
  const [initialDebts, initialSummary] = await Promise.all([
    debtsApi.list({ status: 'open', direction: 'lent' }),
    debtsApi.summary(),
  ]);
  return <DebtsPageClient initialDebts={initialDebts} initialSummary={initialSummary} />;
}
```

Note: nếu `apiFetch` chỉ chạy client-side (read localStorage token), cần server fetch pattern khác — adapt theo `transactions/page.tsx`. Có thể đẩy hoàn toàn vào client (initial state rỗng, fetch trong `useEffect`) nếu phức tạp.

- [ ] **Step 3: Smoke test trang**

Run: `pnpm --filter web dev`
Mở browser http://localhost:3000/debts → trang load không lỗi.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/debts/page.tsx
git commit -m "feat(web): /debts page"
```

---

## Task 23: Frontend — sidebar link

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx` (hoặc nav tương đương)

- [ ] **Step 1: Locate sidebar nav array**

Run: `grep -rn "Giao dịch\|/transactions" apps/web/components/layout/ 2>/dev/null | head`

- [ ] **Step 2: Add link**

Thêm entry sau "Giao dịch":

```tsx
{ href: '/debts', label: 'Nợ & Cho vay', icon: HandCoins },
```

Import: `import { HandCoins } from 'lucide-react';`

- [ ] **Step 3: Verify trong browser**

Reload, click link → đến `/debts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/
git commit -m "feat(web): sidebar link Nợ & Cho vay"
```

---

## Task 24: Full E2E manual smoke

**Files:** none

- [ ] **Step 1: Reset state**

Run: `pnpm --filter api reset:txn -- --keep-opening` (giữ opening, xoá txn + chat).

- [ ] **Step 2: Test golden path qua chat**

Mở http://localhost:3000, login chồng. Trong chat:
- Gõ "cho Hoàng vay 15 triệu" → reply confirm + transaction xuất hiện trong /transactions với amount=-15tr.
- Gõ "Hoàng trả 5 triệu" → reply "✅ Hoàng trả 5.000.000đ • còn 10.000.000đ".
- Mở `/debts` → thấy card Hoàng, còn 10tr/15tr, progress bar ~33%.

- [ ] **Step 3: Test trang /debts**

- Click "Ghi trả" → dialog mở, nhập 10tr → "sẽ đóng khoản này" hiển thị → confirm → tab "Cho vay" rỗng, tab "Đã đóng" có 1 entry.
- Click vào entry "Đã đóng" → drawer mở, list 3 payments (mở 15tr + trả 5tr + trả 10tr). Click "Xoá" trên một repayment → khoản re-open trong tab "Cho vay".

- [ ] **Step 4: Test tạo bằng dialog**

- Click "Tạo khoản mới" → toggle "Đi vay" → "VCB" + 100tr + chọn Quỹ Chồng → tạo → tab "Đi vay" có 1 entry, balance Quỹ Chồng tăng 100tr.

- [ ] **Step 5: Test privacy (nếu có 2 user)**

Đăng nhập vợ, mở `/debts` → không thấy khoản trên quỹ Chồng (riêng). Tạo khoản trên Quỹ Chung → chồng cũng thấy.

- [ ] **Step 6: Test ambiguity**

Tạo 2 khoản lent cùng "Hoàng" (15tr + 10tr). Chat "Hoàng trả 5tr" → expect `ask_clarification`.

- [ ] **Step 7: Commit (nếu có fix)** hoặc skip.

---

## Self-review checklist

Đã verify:

- [x] **Spec coverage**: tất cả section trong spec (data model, API, parser tools, UI, privacy, seed, testing) đều có task tương ứng.
- [x] **No placeholders**: mọi step có code/command cụ thể.
- [x] **Type consistency**: `DebtView`, `DebtPaymentView`, `DebtSummary` dùng nhất quán giữa BE service và FE types; `direction`, `status` enum thống nhất; method names (`createInternal`, `deleteByIdInternal`, `recordPayment`, `deletePayment`, `deleteDebt`) ổn định qua các task.
- [x] **Migration before service code**: Task 4 chạy migration trước Task 8+ implement service.
- [x] **TDD**: Task 9-12 viết test trước khi implement.
- [x] **Commit cadence**: mỗi task có commit riêng, message conventional.
