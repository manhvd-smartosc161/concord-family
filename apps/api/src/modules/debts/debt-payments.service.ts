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
