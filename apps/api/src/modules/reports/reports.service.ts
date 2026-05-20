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
