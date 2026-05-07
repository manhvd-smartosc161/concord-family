import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../../modules/users/entities/user.entity';

export type DevicePlatform = 'ios_pwa' | 'android' | 'desktop';

@Entity('device_tokens')
export class DeviceToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512, name: 'fcm_token' })
  fcmToken!: string;

  @Column({
    type: 'enum',
    enum: ['ios_pwa', 'android', 'desktop'],
    default: 'desktop',
  })
  platform!: DevicePlatform;

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt!: Date;
}
