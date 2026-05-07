import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../shared/common/base.entity';

export type InsightType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'anomaly'
  | 'big_buy'
  | 'ad_hoc';

@Entity('insights')
@Index(['type', 'periodStart'])
export class Insight extends BaseEntity {
  @Column({ type: 'timestamptz', name: 'generated_at' })
  generatedAt!: Date;

  @Column({
    type: 'enum',
    enum: ['daily', 'weekly', 'monthly', 'anomaly', 'big_buy', 'ad_hoc'],
  })
  type!: InsightType;

  /** Markdown content rendered ở UI feed. */
  @Column({ type: 'text', name: 'content_md' })
  contentMd!: string;

  @Column({ type: 'date', nullable: true, name: 'period_start' })
  periodStart!: string | null;

  @Column({ type: 'date', nullable: true, name: 'period_end' })
  periodEnd!: string | null;

  /** Mảng UUID giao dịch được trích trong insight này (để link sâu). */
  @Column({
    type: 'uuid',
    array: true,
    nullable: true,
    name: 'referenced_txn_ids',
  })
  referencedTxnIds!: string[] | null;
}
