import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { bigintTransformer } from '../../common/transformers';
import { Category } from '../../categories/entities/category.entity';
import { Fund } from '../../funds/entities/fund.entity';

export type BudgetPeriod = 'monthly' | 'weekly';

/**
 * Budget cảnh báo. Nếu cả fundId và categoryId đều NULL → ngân sách tổng
 * cho mọi giao dịch. Nếu chỉ fundId set → ngân sách cho cả quỹ (mọi mục).
 * Nếu chỉ categoryId set → ngân sách cho mục đó cross-fund.
 */
@Entity('budgets')
export class Budget extends BaseEntity {
  @Column({ name: 'fund_id', type: 'uuid', nullable: true })
  fundId!: string | null;

  @ManyToOne(() => Fund, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  @Column({
    type: 'bigint',
    name: 'monthly_limit',
    transformer: bigintTransformer,
  })
  monthlyLimit!: number;

  @Column({ type: 'enum', enum: ['monthly', 'weekly'], default: 'monthly' })
  period!: BudgetPeriod;
}
