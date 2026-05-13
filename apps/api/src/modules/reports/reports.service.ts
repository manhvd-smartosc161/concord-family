import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Fund } from '../funds/entities/fund.entity';
import { OPENING_BALANCE_NOTE } from '../funds/opening-balance.constants';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { User } from '../users/entities/user.entity';

export type ReportScope = 'all' | 'joint';

export interface CategoryAggregate {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  amount: number; // positive value of total expense in this category
  count: number;
}

export interface DayAggregate {
  date: string; // YYYY-MM-DD
  income: number;
  expense: number; // positive
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
    private readonly txnService: TransactionsService,
  ) {}

  async monthly(
    user: User,
    year: number,
    month: number,
    scope: ReportScope = 'all',
    fundId?: string,
  ): Promise<MonthlyReport> {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

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
        byDay: this.emptyDays(year, month),
      };
    }

    const allTxns = await this.txnRepo.find({
      where: { familyId: user.familyId!, fundId: In(fundIds), date: Between(start, end) },
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
      // Only count expenses in by-category breakdown
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

    // Fill empty days for chart continuity
    const filledDays = this.emptyDays(year, month).map(
      (d) => byDayMap.get(d.date) ?? d,
    );

    const byCategory = [...byCategoryMap.values()]
      .filter((c) => c.amount > 0) // hide income-only categories from spending breakdown
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

  // ─── helpers ────────────────────────────────────────────────────────

  private emptyDays(year: number, month: number): DayAggregate[] {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const out: DayAggregate[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const iso = new Date(Date.UTC(year, month - 1, d))
        .toISOString()
        .slice(0, 10);
      out.push({ date: iso, income: 0, expense: 0 });
    }
    return out;
  }
}
