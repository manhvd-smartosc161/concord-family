import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

export type TaskCategory = 'shopping' | 'chores' | 'finance' | 'goal';
export type TaskAssignee = 'husband' | 'wife' | 'both';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

@Entity('tasks')
export class Task extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'enum', enum: ['shopping', 'chores', 'finance', 'goal'] })
  category!: TaskCategory;

  @Column({ type: 'enum', enum: ['husband', 'wife', 'both'] })
  assignee!: TaskAssignee;

  @Column({ type: 'enum', enum: ['todo', 'in_progress', 'done'], default: 'todo' })
  status!: TaskStatus;

  @Index()
  @Column({ type: 'varchar', length: 10, name: 'week_year' })
  weekYear!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
