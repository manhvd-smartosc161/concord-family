import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';

@Entity('family_invitations')
export class FamilyInvitation extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'uuid', unique: true })
  token!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'uuid', name: 'accepted_by_id', nullable: true })
  acceptedById!: string | null;
}
