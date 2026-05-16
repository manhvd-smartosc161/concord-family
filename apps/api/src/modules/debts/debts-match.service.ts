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
