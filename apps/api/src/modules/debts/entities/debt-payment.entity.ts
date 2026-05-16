import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../shared/common/transformers';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Debt } from './debt.entity';

export type DebtPaymentKind = 'open' | 'repayment';

@Entity('debt_payments')
@Index(['debtId'])
export class DebtPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'debt_id' })
  debtId!: string;

  @ManyToOne(() => Debt, (d) => d.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt!: Debt;

  @Column({ type: 'uuid', name: 'transaction_id', unique: true })
  transactionId!: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction;

  @Column({ type: 'enum', enum: ['open', 'repayment'] })
  kind!: DebtPaymentKind;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
