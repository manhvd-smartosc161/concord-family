import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/common/base.entity';
import { bigintTransformer } from '../../shared/common/transformers';
import { User } from './user.entity';

/**
 * Khi lương về (cron salary day), agent đọc rule này để tự alloc vào 3 quỹ.
 *   pctToPersonal + pctToJoint = 100
 *   fixedAmountToJoint: nếu set thì luôn alloc số cố định vào quỹ chung trước,
 *                       phần còn lại chia theo pct.
 */
@Entity('salary_rules')
export class SalaryRule extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.salaryRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'integer', name: 'pct_to_personal' })
  pctToPersonal!: number;

  @Column({ type: 'integer', name: 'pct_to_joint' })
  pctToJoint!: number;

  @Column({
    type: 'bigint',
    nullable: true,
    name: 'fixed_amount_to_joint',
    transformer: bigintTransformer,
  })
  fixedAmountToJoint!: number | null;
}
