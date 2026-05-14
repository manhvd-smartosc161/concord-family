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
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';

export type FundType = 'personal' | 'joint';
export type FundPurpose = 'spending' | 'savings' | 'investment';

@Entity('funds')
export class Fund extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: ['personal', 'joint'] })
  type!: FundType;

  /** NULL = quỹ chung; non-null = quỹ riêng của user đó. */
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId!: string | null;

  @ManyToOne(() => User, (user) => user.ownedFunds, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: User | null;

  /** Số dư quỹ tính bằng VND (integer, không có thập phân). */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance!: number;

  /**
   * 'spending' = 3 quỹ chi tiêu gốc (chồng/vợ/chung), không thể archive.
   * 'savings'  = quỹ tiết kiệm user tự tạo gắn mục tiêu (Du lịch, Tiết kiệm năm, ...).
   * 'investment' = quỹ đầu tư (chứng khoán, bất động sản, ...).
   */
  @Column({
    type: 'enum',
    enum: ['spending', 'savings', 'investment'],
    default: 'spending',
  })
  purpose!: FundPurpose;

  @Column({
    type: 'bigint',
    name: 'target_amount',
    nullable: true,
    transformer: bigintTransformer,
  })
  targetAmount!: number | null;

  @Column({ type: 'date', name: 'target_deadline', nullable: true })
  targetDeadline!: string | null;

  /** Cho recurring goal kiểu "đầu tư 10tr/tháng đều đặn". */
  @Column({
    type: 'bigint',
    name: 'monthly_contribution_target',
    nullable: true,
    transformer: bigintTransformer,
  })
  monthlyContributionTarget!: number | null;

  @Column({ type: 'integer', name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @OneToMany(() => Transaction, (txn) => txn.fund)
  transactions!: Transaction[];
}
