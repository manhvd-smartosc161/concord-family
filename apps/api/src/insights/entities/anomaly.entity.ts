import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/common/base.entity';
import { Category } from '../../categories/entities/category.entity';
import { Fund } from '../../funds/entities/fund.entity';

export type AnomalySeverity = 'low' | 'medium' | 'high';

@Entity('anomalies')
export class Anomaly extends BaseEntity {
  @Column({ type: 'timestamptz', name: 'detected_at' })
  detectedAt!: Date;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  @Column({ name: 'fund_id', type: 'uuid', nullable: true })
  fundId!: string | null;

  @ManyToOne(() => Fund, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund | null;

  @Column({ type: 'enum', enum: ['low', 'medium', 'high'] })
  severity!: AnomalySeverity;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt!: Date | null;
}
