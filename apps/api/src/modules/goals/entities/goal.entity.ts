import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { bigintTransformer } from '../../../shared/common/transformers';
import { User } from '../../users/entities/user.entity';

export type GoalPeriod = 'month' | 'year';
export type GoalType = 'save' | 'spend_under';

@Entity('goals')
export class Goal extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  /** NULL = goal chung của 2 vợ chồng (vd: tiết kiệm 150tr/năm). */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({
    type: 'bigint',
    name: 'target_amount',
    transformer: bigintTransformer,
  })
  targetAmount!: number;

  @Column({ type: 'enum', enum: ['month', 'year'] })
  period!: GoalPeriod;

  @Column({ type: 'enum', enum: ['save', 'spend_under'] })
  type!: GoalType;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date' })
  deadline!: string;
}
