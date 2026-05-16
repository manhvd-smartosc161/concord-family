# Debts — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build backend module `debts` cho phép tạo/quản lý nợ + cho vay, link với transactions, fuzzy match counterparty cho AI; privacy theo pattern Concord (private/shared visibility).

**Architecture:** NestJS module trong `apps/api/src/modules/debts/` với 2 entity (`Debt`, `DebtPayment`), service-level privacy enforcement inline, fuzzy match qua PostgreSQL `pg_trgm`. Outstanding tự recompute khi payment thay đổi, auto-close khi outstanding = 0. Endpoint `/debts/match` để AI subagent gọi.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 16 + pg_trgm extension, class-validator.

**Spec:** [docs/superpowers/specs/2026-05-16-debts-design.md](../specs/2026-05-16-debts-design.md)

---

## File map

**Create**:
- `apps/api/migrations/<timestamp>-CreateDebts.ts`
- `apps/api/src/modules/debts/debts.module.ts`
- `apps/api/src/modules/debts/debts.controller.ts`
- `apps/api/src/modules/debts/debts.service.ts`
- `apps/api/src/modules/debts/debt-payments.service.ts`
- `apps/api/src/modules/debts/debts-match.service.ts`
- `apps/api/src/modules/debts/entities/debt.entity.ts`
- `apps/api/src/modules/debts/entities/debt-payment.entity.ts`
- `apps/api/src/modules/debts/dto/create-debt.dto.ts`
- `apps/api/src/modules/debts/dto/update-debt.dto.ts`
- `apps/api/src/modules/debts/dto/create-payment.dto.ts`
- `apps/api/src/modules/debts/dto/match-debt.dto.ts`
- `apps/api/src/modules/debts/dto/list-debts-query.dto.ts`
- `apps/api/src/seeds/debt-categories.seed.ts` (or extend existing categories seed)

**Modify**:
- `apps/api/src/app.module.ts` — register DebtsModule
- `apps/api/src/data-source.ts` — register entities (if entities are auto-loaded by glob, skip)

---

## Phase 1 — Migration & Entities

### Task 1: Create migration file

**Files:**
- Create: `apps/api/migrations/<timestamp>-CreateDebts.ts`

- [ ] **Step 1: Generate timestamp**

Run: `node -e "console.log(Date.now())"`
Note the output number — use it as the timestamp prefix.

- [ ] **Step 2: Create migration file**

File path: `apps/api/migrations/<timestamp>-CreateDebts.ts` (replace `<timestamp>` with output from Step 1).

Content:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDebts<timestamp> implements MigrationInterface {
  name = 'CreateDebts<timestamp>';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `CREATE TYPE "public"."debts_direction_enum" AS ENUM('i_owe', 'they_owe_me')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."debts_visibility_enum" AS ENUM('private', 'shared')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."debts_status_enum" AS ENUM('open', 'closed')`,
    );

    await queryRunner.query(
      `CREATE TABLE "debts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "owner_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "direction" "public"."debts_direction_enum" NOT NULL,
        "counterparty" character varying(200) NOT NULL,
        "principal" bigint NOT NULL,
        "outstanding" bigint NOT NULL,
        "visibility" "public"."debts_visibility_enum" NOT NULL DEFAULT 'private',
        "due_date" date,
        "note" text,
        "status" "public"."debts_status_enum" NOT NULL DEFAULT 'open',
        "closed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_debts_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_debts_principal_positive" CHECK ("principal" > 0),
        CONSTRAINT "CHK_debts_outstanding_nonneg" CHECK ("outstanding" >= 0)
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_debts_family_owner_status" ON "debts" ("family_id", "owner_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debts_family_visibility" ON "debts" ("family_id", "visibility")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debts_counterparty_trgm" ON "debts" USING gin ("counterparty" gin_trgm_ops)`,
    );

    await queryRunner.query(
      `ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "debt_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "debt_id" uuid NOT NULL,
        "transaction_id" uuid,
        "amount" bigint NOT NULL,
        "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "note" text,
        CONSTRAINT "PK_debt_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_debt_payments_amount_positive" CHECK ("amount" > 0)
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_debt_payments_debt" ON "debt_payments" ("debt_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_payments" ADD CONSTRAINT "FK_debt_payments_debt" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_payments" ADD CONSTRAINT "FK_debt_payments_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debt_payments" DROP CONSTRAINT "FK_debt_payments_transaction"`);
    await queryRunner.query(`ALTER TABLE "debt_payments" DROP CONSTRAINT "FK_debt_payments_debt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debt_payments_debt"`);
    await queryRunner.query(`DROP TABLE "debt_payments"`);

    await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_family"`);
    await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_owner"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_counterparty_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_family_visibility"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_family_owner_status"`);
    await queryRunner.query(`DROP TABLE "debts"`);

    await queryRunner.query(`DROP TYPE "public"."debts_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."debts_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."debts_direction_enum"`);
  }
}
```

(Replace `<timestamp>` in class name and `name` field with the actual numeric timestamp.)

- [ ] **Step 3: Run migration**

Run: `pnpm --filter api migration:run`
Expected: log shows `Migration CreateDebts<timestamp> has been executed successfully`.

- [ ] **Step 4: Verify tables exist**

Run: `docker exec concord-postgres psql -U concord -d concord -c "\d debts" -c "\d debt_payments"`
Expected: shows both table schemas with columns matching spec.

- [ ] **Step 5: Verify pg_trgm enabled**

Run: `docker exec concord-postgres psql -U concord -d concord -c "SELECT extname FROM pg_extension WHERE extname='pg_trgm'"`
Expected: 1 row returned.

- [ ] **Step 6: Commit**

```bash
git add apps/api/migrations/
git commit -m "feat(api): add debts + debt_payments tables migration"
```

---

### Task 2: Create Debt entity

**Files:**
- Create: `apps/api/src/modules/debts/entities/debt.entity.ts`

- [ ] **Step 1: Create entity file**

File path: `apps/api/src/modules/debts/entities/debt.entity.ts`

```ts
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { User } from '../../users/entities/user.entity';
import { DebtPayment } from './debt-payment.entity';

export type DebtDirection = 'i_owe' | 'they_owe_me';
export type DebtVisibility = 'private' | 'shared';
export type DebtStatus = 'open' | 'closed';

@Entity('debts')
@Index(['familyId', 'ownerId', 'status'])
@Index(['familyId', 'visibility'])
export class Debt extends BaseEntity {
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ type: 'enum', enum: ['i_owe', 'they_owe_me'] })
  direction!: DebtDirection;

  @Column({ type: 'varchar', length: 200 })
  counterparty!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  principal!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  outstanding!: number;

  @Column({ type: 'enum', enum: ['private', 'shared'], default: 'private' })
  visibility!: DebtVisibility;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'enum', enum: ['open', 'closed'], default: 'open' })
  status!: DebtStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
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

### Task 3: Create DebtPayment entity

**Files:**
- Create: `apps/api/src/modules/debts/entities/debt-payment.entity.ts`

- [ ] **Step 1: Create entity file**

File path: `apps/api/src/modules/debts/entities/debt-payment.entity.ts`

```ts
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Debt } from './debt.entity';

@Entity('debt_payments')
export class DebtPayment extends BaseEntity {
  @Column({ name: 'debt_id', type: 'uuid' })
  debtId!: string;

  @ManyToOne(() => Debt, (d) => d.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt!: Debt;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => Transaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction | null;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt!: Date;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/entities/debt-payment.entity.ts
git commit -m "feat(api): add DebtPayment entity"
```

---

## Phase 2 — DTOs

### Task 4: Create DTOs

**Files:**
- Create: `apps/api/src/modules/debts/dto/create-debt.dto.ts`
- Create: `apps/api/src/modules/debts/dto/update-debt.dto.ts`
- Create: `apps/api/src/modules/debts/dto/create-payment.dto.ts`
- Create: `apps/api/src/modules/debts/dto/match-debt.dto.ts`
- Create: `apps/api/src/modules/debts/dto/list-debts-query.dto.ts`

- [ ] **Step 1: Create `create-debt.dto.ts`**

```ts
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDebtDto {
  @IsEnum(['i_owe', 'they_owe_me'])
  direction!: 'i_owe' | 'they_owe_me';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  counterparty!: string;

  @IsInt()
  @IsPositive()
  principal!: number;

  @IsEnum(['private', 'shared'])
  @IsOptional()
  visibility?: 'private' | 'shared';

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
```

- [ ] **Step 2: Create `update-debt.dto.ts`**

```ts
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDebtDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  counterparty?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  principal?: number;

  @IsEnum(['private', 'shared'])
  @IsOptional()
  visibility?: 'private' | 'shared';

  @IsString()
  @IsOptional()
  dueDate?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
```

- [ ] **Step 3: Create `create-payment.dto.ts`**

```ts
import { IsInt, IsISO8601, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsISO8601()
  paidAt!: string;

  @IsUUID()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
```

- [ ] **Step 4: Create `match-debt.dto.ts`**

```ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class MatchDebtDto {
  @IsString()
  @MinLength(1)
  counterparty!: string;

  @IsString()
  @IsOptional()
  direction?: 'i_owe' | 'they_owe_me';
}
```

- [ ] **Step 5: Create `list-debts-query.dto.ts`**

```ts
import { IsEnum, IsOptional } from 'class-validator';

export class ListDebtsQueryDto {
  @IsEnum(['open', 'closed'])
  @IsOptional()
  status?: 'open' | 'closed';

  @IsEnum(['i_owe', 'they_owe_me'])
  @IsOptional()
  direction?: 'i_owe' | 'they_owe_me';

  @IsEnum(['private', 'shared'])
  @IsOptional()
  visibility?: 'private' | 'shared';
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/debts/dto/
git commit -m "feat(api): add debts DTOs"
```

---

## Phase 3 — Services

### Task 5: DebtsService scaffold + listForUser

**Files:**
- Create: `apps/api/src/modules/debts/debts.service.ts`

- [ ] **Step 1: Create service file**

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateDebtDto } from './dto/create-debt.dto';
import { ListDebtsQueryDto } from './dto/list-debts-query.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { Debt } from './entities/debt.entity';
import { DebtPayment } from './entities/debt-payment.entity';

export type DebtView = {
  id: string;
  direction: Debt['direction'];
  counterparty: string;
  principal: number;
  outstanding: number;
  visibility: Debt['visibility'];
  dueDate: string | null;
  note: string | null;
  status: Debt['status'];
  ownerId: string;
  isMine: boolean;
  createdAt: string;
  closedAt: string | null;
};

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(Debt) private readonly debts: Repository<Debt>,
    @InjectRepository(DebtPayment) private readonly payments: Repository<DebtPayment>,
  ) {}

  async listForUser(user: User, query: ListDebtsQueryDto): Promise<DebtView[]> {
    if (!user.familyId) return [];
    const qb = this.debts
      .createQueryBuilder('d')
      .where('d.family_id = :familyId', { familyId: user.familyId })
      .andWhere('(d.visibility = :shared OR d.owner_id = :ownerId)', {
        shared: 'shared',
        ownerId: user.id,
      })
      .orderBy('d.createdAt', 'DESC');

    if (query.status) qb.andWhere('d.status = :status', { status: query.status });
    if (query.direction) qb.andWhere('d.direction = :direction', { direction: query.direction });
    if (query.visibility) qb.andWhere('d.visibility = :visibility', { visibility: query.visibility });

    const list = await qb.getMany();
    return list.map((d) => this.toView(d, user));
  }

  private toView(d: Debt, user: User): DebtView {
    return {
      id: d.id,
      direction: d.direction,
      counterparty: d.counterparty,
      principal: d.principal,
      outstanding: d.outstanding,
      visibility: d.visibility,
      dueDate: d.dueDate,
      note: d.note,
      status: d.status,
      ownerId: d.ownerId,
      isMine: d.ownerId === user.id,
      createdAt: d.createdAt.toISOString(),
      closedAt: d.closedAt ? d.closedAt.toISOString() : null,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts
git commit -m "feat(api): DebtsService scaffold + listForUser"
```

---

### Task 6: DebtsService.getById + assertCanView/Edit

**Files:**
- Modify: `apps/api/src/modules/debts/debts.service.ts`

- [ ] **Step 1: Add methods to DebtsService**

Add inside the class, after `listForUser`:

```ts
  async getById(user: User, id: string): Promise<DebtView & { payments: ReturnType<DebtsService['toPaymentView']>[] }> {
    if (!user.familyId) throw new NotFoundException('Debt not found');
    const debt = await this.debts.findOne({
      where: { id, familyId: user.familyId },
      relations: ['payments'],
    });
    if (!debt) throw new NotFoundException('Debt not found');
    this.assertCanView(debt, user);
    return {
      ...this.toView(debt, user),
      payments: (debt.payments ?? [])
        .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
        .map((p) => this.toPaymentView(p)),
    };
  }

  toPaymentView(p: DebtPayment) {
    return {
      id: p.id,
      debtId: p.debtId,
      transactionId: p.transactionId,
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      note: p.note,
    };
  }

  assertCanView(debt: Debt, user: User): void {
    if (debt.familyId !== user.familyId) throw new NotFoundException('Debt not found');
    if (debt.visibility === 'private' && debt.ownerId !== user.id) {
      throw new NotFoundException('Debt not found');
    }
  }

  assertCanEdit(debt: Debt, user: User): void {
    this.assertCanView(debt, user);
    if (debt.ownerId !== user.id) {
      throw new ForbiddenException('Only owner can edit this debt');
    }
  }

  async findByIdRaw(id: string): Promise<Debt | null> {
    return this.debts.findOne({ where: { id } });
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts
git commit -m "feat(api): DebtsService.getById + privacy assertions"
```

---

### Task 7: DebtsService.create + update + delete

**Files:**
- Modify: `apps/api/src/modules/debts/debts.service.ts`

- [ ] **Step 1: Add methods**

Add inside class:

```ts
  async create(user: User, dto: CreateDebtDto): Promise<DebtView> {
    if (!user.familyId) throw new ForbiddenException('User has no family');
    const debt = this.debts.create({
      ownerId: user.id,
      familyId: user.familyId,
      direction: dto.direction,
      counterparty: dto.counterparty.trim(),
      principal: dto.principal,
      outstanding: dto.principal,
      visibility: dto.visibility ?? 'private',
      dueDate: dto.dueDate ?? null,
      note: dto.note ?? null,
      status: 'open',
      closedAt: null,
    });
    const saved = await this.debts.save(debt);
    return this.toView(saved, user);
  }

  async update(user: User, id: string, dto: UpdateDebtDto): Promise<DebtView> {
    if (!user.familyId) throw new NotFoundException('Debt not found');
    const debt = await this.debts.findOne({ where: { id, familyId: user.familyId } });
    if (!debt) throw new NotFoundException('Debt not found');
    this.assertCanEdit(debt, user);

    if (dto.principal != null) {
      const paid = await this.sumPayments(debt.id);
      if (dto.principal < paid) {
        throw new ForbiddenException('New principal smaller than total paid');
      }
      debt.principal = dto.principal;
      debt.outstanding = dto.principal - paid;
      if (debt.outstanding === 0 && debt.status !== 'closed') {
        debt.status = 'closed';
        debt.closedAt = new Date();
      } else if (debt.outstanding > 0 && debt.status === 'closed') {
        debt.status = 'open';
        debt.closedAt = null;
      }
    }
    if (dto.counterparty !== undefined) debt.counterparty = dto.counterparty.trim();
    if (dto.visibility !== undefined) debt.visibility = dto.visibility;
    if (dto.dueDate !== undefined) debt.dueDate = dto.dueDate;
    if (dto.note !== undefined) debt.note = dto.note;

    const saved = await this.debts.save(debt);
    return this.toView(saved, user);
  }

  async delete(user: User, id: string): Promise<void> {
    if (!user.familyId) throw new NotFoundException('Debt not found');
    const debt = await this.debts.findOne({ where: { id, familyId: user.familyId } });
    if (!debt) throw new NotFoundException('Debt not found');
    this.assertCanEdit(debt, user);
    await this.debts.remove(debt);
  }

  async close(user: User, id: string): Promise<DebtView> {
    if (!user.familyId) throw new NotFoundException('Debt not found');
    const debt = await this.debts.findOne({ where: { id, familyId: user.familyId } });
    if (!debt) throw new NotFoundException('Debt not found');
    this.assertCanEdit(debt, user);
    debt.status = 'closed';
    debt.closedAt = new Date();
    const saved = await this.debts.save(debt);
    return this.toView(saved, user);
  }

  async reopen(user: User, id: string): Promise<DebtView> {
    if (!user.familyId) throw new NotFoundException('Debt not found');
    const debt = await this.debts.findOne({ where: { id, familyId: user.familyId } });
    if (!debt) throw new NotFoundException('Debt not found');
    this.assertCanEdit(debt, user);
    debt.status = 'open';
    debt.closedAt = null;
    const saved = await this.debts.save(debt);
    return this.toView(saved, user);
  }

  async sumPayments(debtId: string): Promise<number> {
    const row = await this.payments
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.debt_id = :debtId', { debtId })
      .getRawOne<{ total: string }>();
    return row ? parseInt(row.total, 10) : 0;
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/debts.service.ts
git commit -m "feat(api): DebtsService CRUD + close/reopen + sumPayments"
```

---

### Task 8: DebtPaymentsService

**Files:**
- Create: `apps/api/src/modules/debts/debt-payments.service.ts`

- [ ] **Step 1: Create service**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { DebtsService } from './debts.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Debt } from './entities/debt.entity';
import { DebtPayment } from './entities/debt-payment.entity';

@Injectable()
export class DebtPaymentsService {
  constructor(
    @InjectRepository(Debt) private readonly debts: Repository<Debt>,
    @InjectRepository(DebtPayment) private readonly payments: Repository<DebtPayment>,
    private readonly debtsService: DebtsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(user: User, debtId: string, dto: CreatePaymentDto) {
    if (!user.familyId) throw new NotFoundException('Debt not found');

    return await this.dataSource.transaction(async (manager) => {
      const debt = await manager
        .getRepository(Debt)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id AND d.family_id = :familyId', { id: debtId, familyId: user.familyId })
        .getOne();

      if (!debt) throw new NotFoundException('Debt not found');
      this.debtsService.assertCanEdit(debt, user);

      const payment = manager.getRepository(DebtPayment).create({
        debtId: debt.id,
        transactionId: dto.transactionId ?? null,
        amount: dto.amount,
        paidAt: new Date(dto.paidAt),
        note: dto.note ?? null,
      });
      const savedPayment = await manager.getRepository(DebtPayment).save(payment);

      const sumRow = await manager
        .getRepository(DebtPayment)
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.debt_id = :debtId', { debtId: debt.id })
        .getRawOne<{ total: string }>();
      const totalPaid = sumRow ? parseInt(sumRow.total, 10) : 0;

      debt.outstanding = Math.max(0, debt.principal - totalPaid);
      if (debt.outstanding === 0 && debt.status !== 'closed') {
        debt.status = 'closed';
        debt.closedAt = new Date();
      }
      await manager.getRepository(Debt).save(debt);

      return this.debtsService.toPaymentView(savedPayment);
    });
  }

  async delete(user: User, debtId: string, paymentId: string): Promise<void> {
    if (!user.familyId) throw new NotFoundException('Payment not found');

    await this.dataSource.transaction(async (manager) => {
      const debt = await manager
        .getRepository(Debt)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id AND d.family_id = :familyId', { id: debtId, familyId: user.familyId })
        .getOne();
      if (!debt) throw new NotFoundException('Debt not found');
      this.debtsService.assertCanEdit(debt, user);

      const payment = await manager
        .getRepository(DebtPayment)
        .findOne({ where: { id: paymentId, debtId: debt.id } });
      if (!payment) throw new NotFoundException('Payment not found');
      await manager.getRepository(DebtPayment).remove(payment);

      const sumRow = await manager
        .getRepository(DebtPayment)
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.debt_id = :debtId', { debtId: debt.id })
        .getRawOne<{ total: string }>();
      const totalPaid = sumRow ? parseInt(sumRow.total, 10) : 0;

      debt.outstanding = Math.max(0, debt.principal - totalPaid);
      if (debt.outstanding > 0 && debt.status === 'closed') {
        debt.status = 'open';
        debt.closedAt = null;
      }
      await manager.getRepository(Debt).save(debt);
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/debt-payments.service.ts
git commit -m "feat(api): DebtPaymentsService with row-lock + auto-close"
```

---

### Task 9: DebtsMatchService

**Files:**
- Create: `apps/api/src/modules/debts/debts-match.service.ts`

- [ ] **Step 1: Create service**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Debt } from './entities/debt.entity';

export type DebtMatch = {
  id: string;
  counterparty: string;
  outstanding: number;
  direction: Debt['direction'];
  score: number;
};

@Injectable()
export class DebtsMatchService {
  constructor(@InjectRepository(Debt) private readonly debts: Repository<Debt>) {}

  async matchCounterparty(
    user: User,
    counterparty: string,
    direction?: Debt['direction'],
  ): Promise<DebtMatch[]> {
    if (!user.familyId || !counterparty.trim()) return [];

    const qb = this.debts
      .createQueryBuilder('d')
      .select(['d.id', 'd.counterparty', 'd.outstanding', 'd.direction', 'd.visibility', 'd.owner_id'])
      .addSelect('similarity(d.counterparty, :q)', 'score')
      .where('d.family_id = :familyId', { familyId: user.familyId })
      .andWhere('d.status = :open', { open: 'open' })
      .andWhere('(d.visibility = :shared OR d.owner_id = :ownerId)', {
        shared: 'shared',
        ownerId: user.id,
      })
      .andWhere('similarity(d.counterparty, :q) >= 0.4')
      .setParameter('q', counterparty.trim())
      .orderBy('score', 'DESC')
      .limit(2);

    if (direction) {
      qb.andWhere('d.direction = :direction', { direction });
    }

    const rows = await qb.getRawAndEntities();
    return rows.entities.map((d, i) => ({
      id: d.id,
      counterparty: d.counterparty,
      outstanding: d.outstanding,
      direction: d.direction,
      score: parseFloat(rows.raw[i].score),
    }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/debts-match.service.ts
git commit -m "feat(api): DebtsMatchService fuzzy match via pg_trgm"
```

---

## Phase 4 — Controller + Module

### Task 10: DebtsController

**Files:**
- Create: `apps/api/src/modules/debts/debts.controller.ts`

- [ ] **Step 1: Create controller**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtsMatchService } from './debts-match.service';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListDebtsQueryDto } from './dto/list-debts-query.dto';
import { MatchDebtDto } from './dto/match-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/debts')
export class DebtsController {
  constructor(
    private readonly debtsService: DebtsService,
    private readonly paymentsService: DebtPaymentsService,
    private readonly matchService: DebtsMatchService,
  ) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListDebtsQueryDto) {
    return this.debtsService.listForUser(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.getById(user, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateDebtDto) {
    return this.debtsService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.debtsService.delete(user, id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.close(user, id);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.reopen(user, id);
  }

  @Post(':id/payments')
  createPayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(user, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    await this.paymentsService.delete(user, id, paymentId);
  }

  @Post('match')
  match(@CurrentUser() user: User, @Body() dto: MatchDebtDto) {
    return this.matchService.matchCounterparty(user, dto.counterparty, dto.direction);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/debts/debts.controller.ts
git commit -m "feat(api): DebtsController routes"
```

---

### Task 11: DebtsModule + register in AppModule

**Files:**
- Create: `apps/api/src/modules/debts/debts.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create module**

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtsController } from './debts.controller';
import { DebtsMatchService } from './debts-match.service';
import { DebtsService } from './debts.service';
import { Debt } from './entities/debt.entity';
import { DebtPayment } from './entities/debt-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Debt, DebtPayment])],
  controllers: [DebtsController],
  providers: [DebtsService, DebtPaymentsService, DebtsMatchService],
  exports: [DebtsService, DebtPaymentsService, DebtsMatchService],
})
export class DebtsModule {}
```

- [ ] **Step 2: Register in AppModule**

Open `apps/api/src/app.module.ts`. Find the imports section listing modules (FundsModule, TransactionsModule, etc.). Add `DebtsModule`:

```ts
import { DebtsModule } from './modules/debts/debts.module';
```

And add `DebtsModule` to the `imports: [...]` array of `@Module`.

- [ ] **Step 3: Boot API and verify**

Run: `pnpm --filter api dev` (background). Wait ~5s.
Check log for `Nest application successfully started` with no errors.
Also check: `Mapped {/api/debts, ...}` route logs appear.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/debts/debts.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): wire DebtsModule into AppModule"
```

---

## Phase 5 — Smoke test via curl

### Task 12: End-to-end smoke test

**Files:** none (testing only)

Goal: Verify backend works end-to-end with curl. We're not writing automated tests in this plan (project doesn't have a test suite yet — would be a separate add-on).

- [ ] **Step 1: Start API + DB**

Run: `docker compose up -d` then `pnpm --filter api dev` (background).
Wait until "started" log.

- [ ] **Step 2: Get JWT token**

Find or create a user. Login:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"manhvd161@gmail.com","password":"<your-password>"}' \
  | tee /tmp/login.json
```

Extract token:
```bash
TOKEN=$(cat /tmp/login.json | jq -r .accessToken)
echo $TOKEN
```

If `jq` not installed, grep manually.

- [ ] **Step 3: Create a debt**

```bash
curl -X POST http://localhost:3001/api/debts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "direction": "i_owe",
    "counterparty": "Thẻ Sacombank",
    "principal": 8000000,
    "visibility": "private",
    "dueDate": "2026-06-30"
  }'
```

Expected: 201 response with debt JSON, `outstanding: 8000000`, `status: "open"`, `isMine: true`.

Save the returned `id` as `DEBT_ID`.

- [ ] **Step 4: List debts**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/debts
```

Expected: array containing the debt created in Step 3.

- [ ] **Step 5: Add a payment**

```bash
curl -X POST http://localhost:3001/api/debts/$DEBT_ID/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 2000000,
    "paidAt": "2026-05-16T10:00:00Z"
  }'
```

Expected: 201 response with payment.

- [ ] **Step 6: Verify outstanding decreased**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/debts/$DEBT_ID
```

Expected: `outstanding: 6000000`, `payments` array has 1 item, `status: "open"`.

- [ ] **Step 7: Pay off the rest**

```bash
curl -X POST http://localhost:3001/api/debts/$DEBT_ID/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 6000000,
    "paidAt": "2026-05-16T11:00:00Z"
  }'

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/debts/$DEBT_ID
```

Expected: `outstanding: 0`, `status: "closed"`, `closedAt` non-null.

- [ ] **Step 8: Test fuzzy match**

Create a 2nd debt:
```bash
curl -X POST http://localhost:3001/api/debts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"direction":"i_owe","counterparty":"Thẻ Vietcombank","principal":3000000}'
```

Query match:
```bash
curl -X POST http://localhost:3001/api/debts/match \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"counterparty":"thẻ vietcom"}'
```

Expected: array with 1 match `Thẻ Vietcombank`, score > 0.4.

- [ ] **Step 9: Test privacy with 2nd user**

If you have a 2nd test account (e.g. wife), login as them and run:
```bash
TOKEN2=$(curl -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"wife@...","password":"..."}' | jq -r .accessToken)
curl -H "Authorization: Bearer $TOKEN2" http://localhost:3001/api/debts
```

Expected: the private debts from user 1 do NOT appear. Only `shared` debts visible.

- [ ] **Step 10: Stop server and commit notes**

Stop dev server.

```bash
git add -A
git commit --allow-empty -m "chore(api): debts backend smoke-tested"
```

---

## Phase 6 — Seed categories

### Task 13: Add debt-related categories to seed

**Files:**
- Modify: an existing categories seed file or new `apps/api/src/seeds/debt-categories.seed.ts`

- [ ] **Step 1: Find existing categories seed**

Run: `grep -rn "category\|categories" apps/api/src/seeds/ 2>/dev/null | head -10`
Also: `ls apps/api/src/seeds/`

- [ ] **Step 2: Inspect existing seed structure**

Read whichever file declares default categories. Identify pattern (icon, name VN, name EN, kind expense/income).

- [ ] **Step 3: Add 4 categories**

Add to the array of seed categories (within the same file, or append a new array imported into main seed runner):

```ts
{ icon: '💳', nameVi: 'Trả nợ', nameEn: 'Debt repayment', kind: 'expense' },
{ icon: '🤝', nameVi: 'Cho vay', nameEn: 'Lent out', kind: 'expense' },
{ icon: '💰', nameVi: 'Nhận tiền vay', nameEn: 'Received loan', kind: 'income' },
{ icon: '↩️', nameVi: 'Nhận trả nợ', nameEn: 'Received repayment', kind: 'income' },
```

Match the exact field names of the existing seed schema (the placeholder above uses common naming; adapt to project conventions).

- [ ] **Step 4: Run seed**

Run: `pnpm --filter api seed` (or however the project runs seeds — check `package.json` scripts).
Expected: success log; no error about duplicate categories (seed should be idempotent — verify if not by querying DB).

- [ ] **Step 5: Verify**

Run: `docker exec concord-postgres psql -U concord -d concord -c "SELECT * FROM categories WHERE name_vi IN ('Trả nợ','Cho vay','Nhận tiền vay','Nhận trả nợ')"`
Expected: 4 rows.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/seeds/
git commit -m "feat(api): seed debt-related categories"
```

---

## Definition of Done

- [ ] Migration created, applied, rolls back clean
- [ ] `Debt` + `DebtPayment` entities + relations
- [ ] All DTOs validate via class-validator
- [ ] CRUD endpoints work via curl
- [ ] Privacy: private debts hidden from non-owners in same family
- [ ] Privacy: shared debts visible to family, editable only by owner
- [ ] Payments: add reduces outstanding; remove restores it
- [ ] Auto-close at outstanding=0, auto-reopen when payment deleted
- [ ] Row-lock prevents race when concurrent payments add
- [ ] `/debts/match` returns top 2 fuzzy results, threshold ≥ 0.4
- [ ] 4 debt-related categories in seed
- [ ] All commits on `feat/debts` branch
- [ ] No type errors when starting API (`pnpm --filter api dev`)
