import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../shared/common/base.entity';
import { Fund } from '../../funds/entities/fund.entity';
import { User } from '../../users/entities/user.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_sessions')
@Index(['fundId', 'lastMessageAt'])
@Index(['createdById', 'lastMessageAt'])
export class ChatSession extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  /** Fund this conversation belongs to. Joint fund sessions are visible to both spouses. */
  @Column({ name: 'fund_id', type: 'uuid' })
  fundId!: string;

  @ManyToOne(() => Fund, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund;

  /** User who first created the session — used for sorting / display only. */
  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  /** Auto-derived from the first user message, editable later. */
  @Column({ type: 'varchar', length: 200, default: 'Cuộc trò chuyện mới' })
  title!: string;

  /** Used to sort sessions in the sidebar (most-recent first). */
  @Column({ type: 'timestamptz', name: 'last_message_at' })
  lastMessageAt!: Date;

  @OneToMany(() => ChatMessage, (m) => m.session)
  messages!: ChatMessage[];
}
