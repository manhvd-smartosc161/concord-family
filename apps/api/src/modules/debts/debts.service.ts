import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { FamilyEventsNotifier } from '../../shared/notifications/family-events.service';
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
  isLegacy: boolean;
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
    isLegacy: d.isLegacy,
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
    private readonly familyEvents: FamilyEventsNotifier,
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

  async listForUser(
    user: User,
    opts: { status?: 'open' | 'settled' | 'all'; direction?: 'lent' | 'borrowed' | 'all'; fundId?: string },
  ): Promise<DebtView[]> {
    const fundIds = await this.visibleFundIds(user);
    if (fundIds.length === 0) return [];
    const allowedIds = opts.fundId ? fundIds.filter((id) => id === opts.fundId) : fundIds;
    if (allowedIds.length === 0) return [];
    const where: any = { fundId: In(allowedIds), familyId: user.familyId! };
    const status = opts.status ?? 'open';
    if (status !== 'all') where.status = status;
    const direction = opts.direction ?? 'all';
    if (direction !== 'all') where.direction = direction;

    const debts = await this.debtRepo.find({
      where,
      relations: ['fund'],
      order: { openedAt: 'DESC' },
    });
    return debts.map(toDebtView);
  }
  async summaryForUser(user: User, fundId?: string): Promise<DebtSummary> {
    let list = await this.listForUser(user, { status: 'open', direction: 'all' });
    if (fundId) list = list.filter((d) => d.fundId === fundId);
    let totalLent = 0, totalBorrowed = 0, openLentCount = 0, openBorrowedCount = 0;
    for (const d of list) {
      if (d.direction === 'lent') { totalLent += d.remainingAmount; openLentCount++; }
      else { totalBorrowed += d.remainingAmount; openBorrowedCount++; }
    }
    return { totalLent, totalBorrowed, openLentCount, openBorrowedCount };
  }
  async findByIdForUser(user: User, id: string): Promise<{ debt: DebtView; payments: DebtPaymentView[] }> {
    const fundIds = await this.visibleFundIds(user);
    if (fundIds.length === 0) throw new NotFoundException('Khoản nợ không tồn tại hoặc không thấy được.');
    const debt = await this.debtRepo.findOne({
      where: { id, fundId: In(fundIds) },
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
    const isLegacy = input.isLegacy === true;

    return this.dataSource.transaction(async (m) => {
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
        isLegacy,
      });
      const savedDebt = await m.save(debt);

      if (!isLegacy) {
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

        await m.save(m.create(DebtPayment, {
          debtId: savedDebt.id,
          transactionId: txn.id,
          kind: 'open',
          amount: input.principal,
        }));
      }

      savedDebt.fund = fund;
      const result = toDebtView(savedDebt);

      void this.familyEvents.onJointDebtOpened({
        fundId: fund.id,
        direction: input.direction,
        counterpartyName: input.counterpartyName,
        principal: input.principal,
        isLegacy,
        actor: user,
      });

      return result;
    });
  }
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
}
