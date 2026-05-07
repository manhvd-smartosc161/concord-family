import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { bigintTransformer } from '../../common/transformers';
import { Category } from '../../categories/entities/category.entity';
import { Fund } from '../../funds/entities/fund.entity';
import { User } from '../../users/entities/user.entity';

export type TransactionSource =
  | 'chat'
  | 'form'
  | 'photo'
  | 'csv'
  | 'recurring'
  | 'salary';

@Entity('transactions')
@Index(['fundId', 'date'])
@Index(['userId', 'date'])
export class Transaction extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId!: string;

  @ManyToOne(() => Fund, (fund) => fund.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, (cat) => cat.transactions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  /**
   * VND integer. ÂM = chi (expense), DƯƠNG = thu (income / refund / lương vào).
   * Ví dụ "đổ xăng 200k" → amount = -200000.
   */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** Câu chat gốc user gõ (giữ để Parser audit + để embed sau này). */
  @Column({ type: 'text', nullable: true, name: 'raw_text' })
  rawText!: string | null;

  @Column({
    type: 'enum',
    enum: ['chat', 'form', 'photo', 'csv', 'recurring', 'salary'],
  })
  source!: TransactionSource;

  @Column({ type: 'timestamptz' })
  date!: Date;
}
