import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ParseAction } from '../../agent/subagents/parser.subagent';
import { User } from '../../users/entities/user.entity';
import { ChatSession } from './chat-session.entity';

export type ChatMessageRole = 'user' | 'agent';

/**
 * Append-only chat log. Doesn't extend BaseEntity because we don't need
 * `updatedAt` (chat messages are immutable once written).
 */
@Entity('chat_messages')
@Index(['sessionId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => ChatSession, (s) => s.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: ChatSession;

  /** Author. For role='user' = the user who typed; for role='agent' = the user who triggered. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: ['user', 'agent'] })
  role!: ChatMessageRole;

  @Column({ type: 'text' })
  text!: string;

  /** ParseAction[] from agent response — null for user messages. */
  @Column({ type: 'jsonb', nullable: true, name: 'actions_json' })
  actionsJson!: ParseAction[] | null;

  @Column({
    type: 'integer',
    nullable: true,
    name: 'usage_input_tokens',
  })
  usageInputTokens!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
    name: 'usage_output_tokens',
  })
  usageOutputTokens!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
