import { Column, Entity, Index } from 'typeorm';
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

@Entity('yearly_ai_dates_cache')
export class YearlyAiCache extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'jsonb' })
  items!: AiDateItem[];

  @Column({ type: 'timestamptz', name: 'generated_at' })
  generatedAt!: Date;
}
