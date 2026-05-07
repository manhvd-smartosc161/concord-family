import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId!: string | null;

  @ManyToOne(() => Category, (cat) => cat.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: Category | null;

  @OneToMany(() => Category, (cat) => cat.parent)
  children!: Category[];

  /** Tên emoji ngắn (vd "🍜") để render UI. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  icon!: string | null;

  /** Hex color "#A1B2C3" hoặc tên màu Tailwind. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  color!: string | null;

  /**
   * Khoản thiết yếu (điện nước, ăn uống, đi lại) — agent ưu tiên giữ khi
   * khuyến nghị cắt giảm chi tiêu để đạt goal tiết kiệm.
   */
  @Column({ type: 'boolean', default: false, name: 'is_essential' })
  isEssential!: boolean;

  @OneToMany(() => Transaction, (txn) => txn.category)
  transactions!: Transaction[];
}
