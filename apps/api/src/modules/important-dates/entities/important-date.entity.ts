import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

export type ImportantDateType =
  | 'birthday'
  | 'death_anniversary'
  | 'anniversary'
  | 'other';

@Entity('important_dates')
export class ImportantDate extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({
    type: 'enum',
    enum: ['birthday', 'death_anniversary', 'anniversary', 'other'],
    default: 'other',
  })
  type!: ImportantDateType;

  @Index()
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'boolean', name: 'is_lunar', default: false })
  isLunar!: boolean;

  @Column({
    type: 'int',
    array: true,
    name: 'remind_days_before',
    default: '{0}',
  })
  remindDaysBefore!: number[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById!: string;
}
