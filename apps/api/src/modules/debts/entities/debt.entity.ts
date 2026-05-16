import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { User } from '../../users/entities/user.entity';
import { DebtPayment } from './debt-payment.entity';

export type DebtDirection = 'i_owe' | 'they_owe_me';
export type DebtVisibility = 'private' | 'shared';
export type DebtStatus = 'open' | 'closed';

@Entity('debts')
@Index(['familyId', 'ownerId', 'status'])
@Index(['familyId', 'visibility'])
export class Debt extends BaseEntity {
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ type: 'enum', enum: ['i_owe', 'they_owe_me'] })
  direction!: DebtDirection;

  @Column({ type: 'varchar', length: 200 })
  counterparty!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  principal!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  outstanding!: number;

  @Column({ type: 'enum', enum: ['private', 'shared'], default: 'private' })
  visibility!: DebtVisibility;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'enum', enum: ['open', 'closed'], default: 'open' })
  status!: DebtStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @OneToMany(() => DebtPayment, (p) => p.debt)
  payments!: DebtPayment[];
}
