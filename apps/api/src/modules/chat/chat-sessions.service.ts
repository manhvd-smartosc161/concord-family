import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ParseAction } from '../../agent/subagents/parser/parser.subagent';
import { Fund } from '../funds/entities/fund.entity';
import { User } from '../users/entities/user.entity';
import {
  ChatMessage,
  type ChatMessageRole,
} from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';

export interface ChatSessionView {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  fundId: string;
  fundName: string;
}

export interface ChatMessageView {
  id: string;
  role: ChatMessageRole;
  text: string;
  actions: ParseAction[] | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  author: { id: string; name: string };
  createdAt: string;
}

@Injectable()
export class ChatSessionsService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
  ) {}

  // ─── Sessions ────────────────────────────────────────────────────────

  /** All sessions visible to user: in their personal fund + any joint fund. */
  async listForUser(user: User): Promise<ChatSessionView[]> {
    const rows = await this.sessionRepo
      .createQueryBuilder('s')
      .innerJoin('s.fund', 'f')
      .leftJoin('s.messages', 'm')
      .where('(f.type = :joint OR f.owner_id = :userId)', {
        joint: 'joint',
        userId: user.id,
      })
      .select([
        's.id',
        's.title',
        's.createdAt',
        's.lastMessageAt',
        's.fundId',
        'f.name',
      ])
      .addSelect('COUNT(m.id)', 'msgcount')
      .groupBy('s.id')
      .addGroupBy('f.id')
      .orderBy('s.lastMessageAt', 'DESC')
      .getRawAndEntities<{ msgcount: string; f_name: string }>();

    return rows.entities.map((s, i) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      lastMessageAt: s.lastMessageAt.toISOString(),
      messageCount: parseInt(rows.raw[i].msgcount, 10) || 0,
      fundId: s.fundId,
      fundName: rows.raw[i].f_name,
    }));
  }

  async create(
    user: User,
    fundId: string,
    title?: string,
  ): Promise<ChatSessionView> {
    const fund = await this.fundRepo.findOneBy({ id: fundId });
    if (!fund) throw new BadRequestException('Quỹ không tồn tại');
    if (fund.type === 'personal' && fund.ownerId !== user.id) {
      throw new ForbiddenException(
        `Không thể tạo chat trong ${fund.name} (quỹ riêng của người khác)`,
      );
    }

    const session = this.sessionRepo.create({
      fundId: fund.id,
      createdById: user.id,
      title: title?.slice(0, 200) || 'Cuộc trò chuyện mới',
      lastMessageAt: new Date(),
    });
    const saved = await this.sessionRepo.save(session);
    return {
      id: saved.id,
      title: saved.title,
      createdAt: saved.createdAt.toISOString(),
      lastMessageAt: saved.lastMessageAt.toISOString(),
      messageCount: 0,
      fundId: fund.id,
      fundName: fund.name,
    };
  }

  async delete(user: User, sessionId: string): Promise<void> {
    const session = await this.findAccessible(user, sessionId);
    await this.sessionRepo.delete({ id: session.id });
  }

  // ─── Messages ────────────────────────────────────────────────────────

  async listMessages(
    user: User,
    sessionId: string,
  ): Promise<ChatMessageView[]> {
    await this.findAccessible(user, sessionId);
    const msgs = await this.messageRepo.find({
      where: { sessionId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return msgs.map(this.toMessageView);
  }

  /**
   * Lấy N messages gần nhất của session (theo thứ tự ASC), dùng để build
   * conversation history cho parser. Trả về cả role + text — caller tự map.
   */
  async recentMessages(
    sessionId: string,
    limit = 20,
  ): Promise<Array<{ role: ChatMessageRole; text: string }>> {
    const rows = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 100)),
    });
    return rows.reverse().map((m) => ({ role: m.role, text: m.text }));
  }

  async appendMessage(
    sessionId: string,
    userId: string,
    role: ChatMessageRole,
    text: string,
    actions: ParseAction[] | null = null,
    usage: { inputTokens: number; outputTokens: number } | null = null,
  ): Promise<ChatMessage> {
    const msg = this.messageRepo.create({
      sessionId,
      userId,
      role,
      text,
      actionsJson: actions,
      usageInputTokens: usage?.inputTokens ?? null,
      usageOutputTokens: usage?.outputTokens ?? null,
    });
    const saved = await this.messageRepo.save(msg);
    await this.sessionRepo.update(
      { id: sessionId },
      { lastMessageAt: saved.createdAt },
    );
    return saved;
  }

  /** First user message becomes the session title (truncated). */
  async maybeSetTitle(sessionId: string, fromText: string): Promise<void> {
    const session = await this.sessionRepo.findOneBy({ id: sessionId });
    if (!session || session.title !== 'Cuộc trò chuyện mới') return;
    const trimmed = fromText.trim().slice(0, 80);
    if (!trimmed) return;
    await this.sessionRepo.update({ id: sessionId }, { title: trimmed });
  }

  /**
   * Throws 404 if not exists, 403 if user can't access:
   * - Personal fund session: only fund owner
   * - Joint fund session: both spouses
   */
  async findAccessible(user: User, sessionId: string): Promise<ChatSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: { fund: true },
    });
    if (!session) {
      throw new NotFoundException('Session không tồn tại');
    }
    const fund = session.fund;
    if (fund.type === 'personal' && fund.ownerId !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập chat ở quỹ riêng của người khác',
      );
    }
    return session;
  }

  private toMessageView = (m: ChatMessage): ChatMessageView => ({
    id: m.id,
    role: m.role,
    text: m.text,
    actions: m.actionsJson,
    usage:
      m.usageInputTokens != null && m.usageOutputTokens != null
        ? {
            inputTokens: m.usageInputTokens,
            outputTokens: m.usageOutputTokens,
          }
        : null,
    author: { id: m.user.id, name: m.user.name },
    createdAt: m.createdAt.toISOString(),
  });
}
