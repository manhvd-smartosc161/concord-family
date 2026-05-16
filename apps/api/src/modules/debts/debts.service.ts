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
