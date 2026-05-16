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
