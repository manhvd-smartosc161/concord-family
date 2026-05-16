import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { Fund } from '../../funds/entities/fund.entity';
import { User } from '../../users/entities/user.entity';
import { DebtPayment } from './debt-payment.entity';

export type DebtDirection = 'lent' | 'borrowed';
export type DebtStatus = 'open' | 'settled';

@Entity('debts')
@Index(['familyId'])
@Index(['fundId'])
@Index(['userId', 'status'])
export class Debt extends BaseEntity {
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', name: 'fund_id' })
  fundId!: string;

  @ManyToOne(() => Fund, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund;

  @Column({ type: 'enum', enum: ['lent', 'borrowed'] })
  direction!: DebtDirection;

  @Column({ type: 'text', name: 'counterparty_name' })
  counterpartyName!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  principal!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer, name: 'remaining_amount' })
  remainingAmount!: number;

  @Column({ type: 'enum', enum: ['open', 'settled'], default: 'open' })
  status!: DebtStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'timestamptz', name: 'opened_at' })
  openedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'closed_at' })
  closedAt!: Date | null;

  @OneToMany(() => DebtPayment, (p) => p.debt)
  payments!: DebtPayment[];
}
