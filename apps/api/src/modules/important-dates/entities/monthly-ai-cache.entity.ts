import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

export type AiDateKind =
  | 'lunar'
  | 'national'
  | 'international'
  | 'religious'
  | 'other';

export interface AiDateItem {
  date: string;
  name: string;
  kind: AiDateKind;
  notes: string | null;
  remindDaysBefore: number[];
}

@Entity('monthly_ai_dates_cache')
@Unique(['year', 'month'])
export class MonthlyAiCache extends BaseEntity {
  @Index()
  @Column({ type: 'int' })
  year!: number;

  @Index()
  @Column({ type: 'int' })
  month!: number;

  @Column({ type: 'jsonb' })
  items!: AiDateItem[];

  @Column({ type: 'timestamptz', name: 'generated_at' })
  generatedAt!: Date;
}
