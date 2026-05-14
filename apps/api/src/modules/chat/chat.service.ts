import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParserSubagent } from '../../agent/subagents/parser/parser.subagent';
import { Fund } from '../funds/entities/fund.entity';
import { User } from '../users/entities/user.entity';
import { ChatSessionsService } from './chat-sessions.service';
import type { ChatRequestDto, ChatResponseDto } from './chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly parser: ParserSubagent,
    private readonly sessions: ChatSessionsService,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
  ) {}

  private async resolveDefaultFundName(
    visibility: 'private' | 'public',
    user: User,
  ): Promise<string | undefined> {
    if (visibility === 'private') {
      const fund = await this.fundRepo.findOne({
        where: {
          familyId: user.familyId!,
          type: 'personal',
          ownerId: user.id,
          purpose: 'spending',
        },
      });
      return fund?.name;
    }
    const fund = await this.fundRepo.findOne({
      where: { familyId: user.familyId!, type: 'joint', purpose: 'spending' },
    });
    return fund?.name;
  }

  async handle(dto: ChatRequestDto, user: User): Promise<ChatResponseDto> {
    if (!dto.sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const session = await this.sessions.findAccessible(user, dto.sessionId);
    const sessionId = session.id;
    const defaultFundName = await this.resolveDefaultFundName(
      session.visibility,
      user,
    );

    const history = await this.sessions.recentMessages(sessionId, 20);

    const userMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'user',
      dto.message,
    );
    await this.sessions.maybeSetTitle(sessionId, dto.message);

    const result = await this.parser.parse(dto.message, user, {
      defaultFundName,
      history,
    });

    // Persist agent reply
    const agentMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'agent',
      result.reply,
      result.actions,
      result.usage,
    );

    return {
      reply: result.reply,
      actions: result.actions,
      stopReason: result.stopReason,
      usage: result.usage,
      sessionId,
      userMessageId: userMsg.id,
      agentMessageId: agentMsg.id,
    };
  }
}
