import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import type { CreateEnvelopeDto } from './dto/create-envelope.dto';
import type { UpdateEnvelopeDto } from './dto/update-envelope.dto';
import { Fund } from './entities/fund.entity';
import { OPENING_BALANCE_NOTE } from './opening-balance.constants';

export type FundAccessLevel = 'owner' | 'joint' | 'private';

export interface FundView {
  id: string;
  name: string;
  type: 'personal' | 'joint';
  accessLevel: FundAccessLevel;
  /** Only present when accessLevel ≠ 'private'. */
  balance: number | null;
  /** Số dư khởi đầu (do user khai báo khi bắt đầu xài app). null khi private. */
  openingBalance: number | null;
  purpose: 'general' | 'envelope';
  targetAmount: number | null;
  targetDeadline: string | null;
  monthlyContributionTarget: number | null;
  archivedAt: string | null;
  /** Progress fields — chỉ tính cho envelope. */
  progress?: EnvelopeProgress;
}

export interface EnvelopeProgress {
  /** % balance/target, capped 0..100. null khi không có target. */
  percent: number | null;
  /** ahead/on_track/behind/null (null khi không có deadline hoặc target). */
  paceStatus: 'ahead' | 'on_track' | 'behind' | null;
  daysElapsed: number | null;
  daysTotal: number | null;
  daysRemaining: number | null;
  /** Sum positive inflow tháng hiện tại (chỉ tính khi có monthlyContributionTarget). */
  monthContribution: number | null;
  /** Đã đạt target chưa. */
  reached: boolean;
}

@Injectable()
export class FundsService {
  constructor(
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  async listForUser(user: User): Promise<FundView[]> {
    const funds = await this.fundRepo.find({
      where: { archivedAt: IsNull() },
    });
    // Order: Chung (joint general) → envelopes (joint envelope) → personal.
    funds.sort((a, b) => {
      const order = (f: Fund) => {
        if (f.purpose === 'envelope') return 1;
        if (f.type === 'joint') return 0;
        return 2;
      };
      const oa = order(a);
      const ob = order(b);
      if (oa !== ob) return oa - ob;
      if (a.displayOrder !== b.displayOrder)
        return a.displayOrder - b.displayOrder;
      return a.name.localeCompare(b.name, 'vi');
    });

    const openings = await this.txnRepo.find({
      where: { note: OPENING_BALANCE_NOTE },
    });
    const openingByFundId = new Map<string, number>();
    for (const t of openings) openingByFundId.set(t.fundId, t.amount);

    return funds.map((f): FundView => this.toView(f, user, openingByFundId));
  }

  private toView(
    f: Fund,
    user: User,
    openingByFundId: Map<string, number>,
  ): FundView {
    let access: FundAccessLevel;
    if (f.type === 'joint') access = 'joint';
    else if (f.ownerId === user.id) access = 'owner';
    else access = 'private';

    const isPrivate = access === 'private';
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      accessLevel: access,
      balance: isPrivate ? null : f.balance,
      openingBalance: isPrivate ? null : (openingByFundId.get(f.id) ?? 0),
      purpose: f.purpose,
      targetAmount: f.targetAmount,
      targetDeadline: f.targetDeadline,
      monthlyContributionTarget: f.monthlyContributionTarget,
      archivedAt: f.archivedAt ? f.archivedAt.toISOString() : null,
    };
  }

  // ─── Envelopes ───────────────────────────────────────────────────────

  async listEnvelopes(user: User): Promise<FundView[]> {
    const funds = await this.fundRepo.find({
      where: { purpose: 'envelope' },
      order: { archivedAt: 'ASC', displayOrder: 'ASC', name: 'ASC' },
    });
    const openings = await this.txnRepo.find({
      where: { note: OPENING_BALANCE_NOTE },
    });
    const openingByFundId = new Map<string, number>();
    for (const t of openings) openingByFundId.set(t.fundId, t.amount);

    // Tính monthContribution cho các envelope có monthlyContributionTarget.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const envIdsNeedMonth = funds
      .filter((f) => f.monthlyContributionTarget != null)
      .map((f) => f.id);
    const monthInflowByFund = new Map<string, number>();
    if (envIdsNeedMonth.length > 0) {
      const rows = await this.txnRepo
        .createQueryBuilder('t')
        .select('t.fund_id', 'fundId')
        .addSelect('SUM(t.amount)::bigint', 'total')
        .where('t.fund_id IN (:...ids)', { ids: envIdsNeedMonth })
        .andWhere('t.date >= :start', { start: monthStart })
        .andWhere('t.amount > 0')
        .andWhere('(t.note IS NULL OR t.note <> :marker)', {
          marker: OPENING_BALANCE_NOTE,
        })
        .groupBy('t.fund_id')
        .getRawMany<{ fundId: string; total: string }>();
      for (const r of rows) {
        monthInflowByFund.set(r.fundId, parseInt(r.total, 10) || 0);
      }
    }

    return funds.map((f) => {
      const view = this.toView(f, user, openingByFundId);
      view.progress = this.computeEnvelopeProgress(
        f,
        view.balance ?? 0,
        monthInflowByFund.get(f.id) ?? null,
      );
      return view;
    });
  }

  private computeEnvelopeProgress(
    fund: Fund,
    balance: number,
    monthContribution: number | null,
  ): EnvelopeProgress {
    const target = fund.targetAmount;
    const deadline = fund.targetDeadline ? new Date(fund.targetDeadline) : null;
    const start = fund.createdAt;
    const now = new Date();

    const percent =
      target && target > 0
        ? Math.max(0, Math.min(100, (balance / target) * 100))
        : null;

    let daysElapsed: number | null = null;
    let daysTotal: number | null = null;
    let daysRemaining: number | null = null;
    let paceStatus: 'ahead' | 'on_track' | 'behind' | null = null;

    if (deadline) {
      daysTotal = Math.max(1, Math.ceil((+deadline - +start) / 86_400_000));
      daysElapsed = Math.min(
        daysTotal,
        Math.max(0, Math.ceil((+now - +start) / 86_400_000)),
      );
      daysRemaining = Math.max(0, daysTotal - daysElapsed);

      if (target && target > 0 && daysTotal > 0) {
        const expected = (target / daysTotal) * daysElapsed;
        if (balance >= expected * 1.05) paceStatus = 'ahead';
        else if (balance >= expected * 0.95) paceStatus = 'on_track';
        else paceStatus = 'behind';
      }
    }

    const reached = !!(target && target > 0 && balance >= target);

    return {
      percent,
      paceStatus,
      daysElapsed,
      daysTotal,
      daysRemaining,
      monthContribution:
        fund.monthlyContributionTarget != null
          ? (monthContribution ?? 0)
          : null,
      reached,
    };
  }

  async createEnvelope(dto: CreateEnvelopeDto): Promise<FundView> {
    const trimmed = dto.name.trim();
    if (!trimmed) throw new BadRequestException('Tên quỹ không được rỗng');

    const dup = await this.fundRepo.findOneBy({ name: trimmed });
    if (dup)
      throw new BadRequestException(
        `Đã có quỹ tên "${trimmed}". Đặt tên khác đi.`,
      );

    const last = await this.fundRepo
      .createQueryBuilder('f')
      .where('f.purpose = :p', { p: 'envelope' })
      .orderBy('f.display_order', 'DESC')
      .getOne();

    const created = this.fundRepo.create({
      name: trimmed,
      type: 'joint',
      ownerId: null,
      balance: 0,
      purpose: 'envelope',
      targetAmount: dto.targetAmount ?? null,
      targetDeadline: dto.targetDeadline ?? null,
      monthlyContributionTarget: dto.monthlyContributionTarget ?? null,
      displayOrder: (last?.displayOrder ?? 0) + 1,
      archivedAt: null,
    });
    const saved = await this.fundRepo.save(created);
    return this.envelopeView(saved.id);
  }

  async updateEnvelope(
    fundId: string,
    dto: UpdateEnvelopeDto,
  ): Promise<FundView> {
    const fund = await this.fundRepo.findOneBy({ id: fundId });
    if (!fund) throw new NotFoundException('Quỹ không tồn tại');
    if (fund.purpose !== 'envelope')
      throw new BadRequestException(
        'Chỉ có thể sửa quỹ mục tiêu, không phải tài khoản gốc',
      );

    if (dto.name !== undefined) {
      const t = dto.name.trim();
      if (!t) throw new BadRequestException('Tên không được rỗng');
      const dup = await this.fundRepo
        .createQueryBuilder('f')
        .where('f.name = :n AND f.id <> :id', { n: t, id: fundId })
        .getOne();
      if (dup)
        throw new BadRequestException(`Đã có quỹ tên "${t}". Đặt tên khác đi.`);
      fund.name = t;
    }
    if (dto.targetAmount !== undefined) fund.targetAmount = dto.targetAmount;
    if (dto.targetDeadline !== undefined)
      fund.targetDeadline = dto.targetDeadline;
    if (dto.monthlyContributionTarget !== undefined)
      fund.monthlyContributionTarget = dto.monthlyContributionTarget;

    await this.fundRepo.save(fund);
    return this.envelopeView(fund.id);
  }

  async archiveEnvelope(fundId: string): Promise<FundView> {
    const fund = await this.fundRepo.findOneBy({ id: fundId });
    if (!fund) throw new NotFoundException('Quỹ không tồn tại');
    if (fund.purpose !== 'envelope')
      throw new BadRequestException('Chỉ archive được quỹ mục tiêu');
    fund.archivedAt = new Date();
    await this.fundRepo.save(fund);
    return this.envelopeView(fund.id);
  }

  async unarchiveEnvelope(fundId: string): Promise<FundView> {
    const fund = await this.fundRepo.findOneBy({ id: fundId });
    if (!fund) throw new NotFoundException('Quỹ không tồn tại');
    if (fund.purpose !== 'envelope')
      throw new BadRequestException('Chỉ unarchive được quỹ mục tiêu');
    fund.archivedAt = null;
    await this.fundRepo.save(fund);
    return this.envelopeView(fund.id);
  }

  private async envelopeView(fundId: string): Promise<FundView> {
    const fund = await this.fundRepo.findOneByOrFail({ id: fundId });
    const opening = await this.txnRepo.findOne({
      where: { fundId, note: OPENING_BALANCE_NOTE },
    });
    const openingMap = new Map<string, number>();
    if (opening) openingMap.set(fundId, opening.amount);
    // Envelope luôn joint → toView không cần real user
    return this.toView(fund, { id: '', role: 'husband' } as User, openingMap);
  }

  /**
   * Upsert "số dư khởi đầu" cho 1 quỹ. Tạo (hoặc cập nhật) 1 transaction
   * marker với note = '__opening_balance__', date = now. Balance được điều
   * chỉnh bằng delta (newAmount − oldOpening) để không phá các txn khác.
   */
  async setOpeningBalance(
    user: User,
    fundId: string,
    amount: number,
  ): Promise<FundView> {
    const fund = await this.fundRepo.findOneBy({ id: fundId });
    if (!fund) throw new NotFoundException('Quỹ không tồn tại');
    if (fund.type === 'personal' && fund.ownerId !== user.id) {
      throw new ForbiddenException(
        'Không thể set số dư khởi đầu cho quỹ riêng của người khác',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Transaction, {
        where: { fundId: fund.id, note: OPENING_BALANCE_NOTE },
      });

      const oldAmount = existing?.amount ?? 0;
      const delta = amount - oldAmount;

      if (existing) {
        await manager.update(
          Transaction,
          { id: existing.id },
          { amount, date: new Date() },
        );
      } else {
        await manager.save(
          manager.create(Transaction, {
            userId: user.id,
            fundId: fund.id,
            categoryId: null,
            amount,
            note: OPENING_BALANCE_NOTE,
            rawText: null,
            source: 'form',
            date: new Date(),
          }),
        );
      }

      if (delta !== 0) {
        await manager.increment(Fund, { id: fund.id }, 'balance', delta);
      }
    });

    const list = await this.listForUser(user);
    return list.find((f) => f.id === fundId)!;
  }
}
