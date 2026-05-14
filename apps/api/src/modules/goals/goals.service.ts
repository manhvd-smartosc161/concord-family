import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { Fund } from '../funds/entities/fund.entity';
import { OPENING_BALANCE_NOTE } from '../funds/opening-balance.constants';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Goal } from './entities/goal.entity';

export interface GoalView {
  id: string;
  type: 'save' | 'spend_under';
  period: 'month' | 'year';
  scope: 'couple' | 'personal';
  targetAmount: number;
  startDate: string;
  deadline: string;
  // computed
  currentProgress: number;
  projection: number;
  paceStatus: 'ahead' | 'on_track' | 'behind';
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
}

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
  ) {}

  /** All goals visible to this user — couple goals + their own personal goals. */
  async listForUser(user: User): Promise<GoalView[]> {
    const goals = await this.goalRepo.find({
      where: [
        { familyId: user.familyId!, userId: IsNull() },
        { familyId: user.familyId!, userId: user.id },
      ],
      order: { startDate: 'ASC' },
    });

    const views: GoalView[] = [];
    for (const g of goals) {
      const view = await this.computeProgress(g);
      views.push(view);
    }
    return views;
  }

  async upsertYearlySavings(
    user: User,
    targetAmount: number,
  ): Promise<GoalView> {
    const year = new Date().getFullYear();
    let goal = await this.goalRepo.findOne({
      where: {
        familyId: user.familyId!,
        userId: IsNull(),
        period: 'year',
        type: 'save',
      },
    });
    if (goal) {
      goal.targetAmount = targetAmount;
      goal.startDate = `${year}-01-01`;
      goal.deadline = `${year}-12-31`;
      goal = await this.goalRepo.save(goal);
    } else {
      goal = await this.goalRepo.save(
        this.goalRepo.create({
          familyId: user.familyId!,
          userId: null,
          targetAmount,
          period: 'year',
          type: 'save',
          startDate: `${year}-01-01`,
          deadline: `${year}-12-31`,
        }),
      );
    }
    return this.computeProgress(goal);
  }

  private async computeProgress(g: Goal): Promise<GoalView> {
    const start = new Date(g.startDate);
    const deadline = new Date(g.deadline);
    const now = new Date();

    const daysTotal = Math.max(1, Math.ceil((+deadline - +start) / 86_400_000));
    const daysElapsed = Math.min(
      daysTotal,
      Math.max(0, Math.ceil((+now - +start) / 86_400_000)),
    );
    const daysRemaining = Math.max(0, daysTotal - daysElapsed);

    const isCoupleSave = !g.userId && g.type === 'save';

    let fundIds: string[];
    if (isCoupleSave) {
      fundIds = (
        await this.fundRepo.find({
          where: {
            familyId: g.familyId,
            purpose: In(['savings', 'investment']),
          },
        })
      ).map((f) => f.id);
    } else if (g.userId) {
      fundIds = (
        await this.fundRepo.find({
          where: { familyId: g.familyId, ownerId: g.userId },
        })
      ).map((f) => f.id);
    } else {
      fundIds = (
        await this.fundRepo.find({ where: { familyId: g.familyId } })
      ).map((f) => f.id);
    }

    const allTxns = fundIds.length
      ? await this.txnRepo.find({
          where: {
            fundId: In(fundIds),
            date: Between(start, now < deadline ? now : deadline),
          },
          relations: { category: true },
        })
      : [];

    // Couple savings: GIỮ "Chuyển nội bộ" — đây chính là hành động tiết kiệm.
    // Chỉ loại opening_balance để không double-count số dư khai báo đầu kỳ.
    const txns = isCoupleSave
      ? allTxns.filter((t) => t.note !== OPENING_BALANCE_NOTE)
      : allTxns.filter(
          (t) =>
            t.category?.name !== 'Chuyển nội bộ' &&
            t.note !== OPENING_BALANCE_NOTE,
        );

    let income = 0;
    let expense = 0;
    for (const t of txns) {
      if (t.amount >= 0) income += t.amount;
      else expense += -t.amount;
    }

    const currentProgress = g.type === 'save' ? income - expense : expense;
    const dailyRate = daysElapsed > 0 ? currentProgress / daysElapsed : 0;
    const projection = Math.round(dailyRate * daysTotal);

    let paceStatus: 'ahead' | 'on_track' | 'behind';
    if (g.type === 'save') {
      const target = g.targetAmount;
      const expected = (target / daysTotal) * daysElapsed;
      if (currentProgress >= expected * 1.05) paceStatus = 'ahead';
      else if (currentProgress >= expected * 0.95) paceStatus = 'on_track';
      else paceStatus = 'behind';
    } else {
      // spend_under: lower is better
      const target = g.targetAmount;
      const expectedMax = (target / daysTotal) * daysElapsed;
      if (currentProgress <= expectedMax * 0.95) paceStatus = 'ahead';
      else if (currentProgress <= expectedMax * 1.05) paceStatus = 'on_track';
      else paceStatus = 'behind';
    }

    return {
      id: g.id,
      type: g.type,
      period: g.period,
      scope: g.userId ? 'personal' : 'couple',
      targetAmount: g.targetAmount,
      startDate: g.startDate,
      deadline: g.deadline,
      currentProgress,
      projection,
      paceStatus,
      daysElapsed,
      daysTotal,
      daysRemaining,
    };
  }
}
