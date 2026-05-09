import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

@Entity('families')
export class Family extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'date', nullable: true, name: 'wedding_date' })
  weddingDate!: string | null;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById!: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt!: Date | null;
}
