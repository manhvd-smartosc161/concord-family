import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../shared/common/base.entity';
import { Fund } from '../../funds/entities/fund.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { SalaryRule } from './salary-rule.entity';

export type UserRole = 'husband' | 'wife';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: ['husband', 'wife'] })
  role!: UserRole;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'hashed_password' })
  hashedPassword!: string;

  @OneToMany(() => Fund, (fund) => fund.owner)
  ownedFunds!: Fund[];

  @OneToMany(() => Transaction, (txn) => txn.user)
  transactions!: Transaction[];

  @OneToMany(() => SalaryRule, (rule) => rule.user)
  salaryRules!: SalaryRule[];
}
