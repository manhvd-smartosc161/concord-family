import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Debt } from './debt.entity';

@Entity('debt_payments')
export class DebtPayment extends BaseEntity {
  @Column({ name: 'debt_id', type: 'uuid' })
  debtId!: string;

  @ManyToOne(() => Debt, (d) => d.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt!: Debt;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => Transaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction | null;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt!: Date;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
